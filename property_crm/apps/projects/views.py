"""
apps/projects/views.py
"""

from django.db.models import Case, Count, IntegerField, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Coalesce
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.core.agency_scoping import AgencyScope
from apps.core.permissions import HasPermission
from apps.projects.models import Lot, LotAgency, Project, ProjectAgency, ProjectMedia, Stage
from apps.projects.serializers import (
    ProjectDetailSerializer,
    ProjectListSerializer,
    ProjectMediaSerializer,
    StageSerializer,
)

try:
    from apps.sales.models import Sale
except ImportError:
    Sale = None


def _annotate_lot_status_counts(project_qs):
    lots = Lot.objects.filter(stage__project=OuterRef("pk"))

    def _count_subq(filter_q):
        return Coalesce(
            Subquery(
                lots.filter(filter_q).values("stage__project").annotate(n=Count("id")).values("n")[:1],
                output_field=IntegerField(),
            ),
            Value(0),
        )

    return project_qs.annotate(
        _count_total=Coalesce(Subquery(lots.values("stage__project").annotate(n=Count("id")).values("n")[:1], output_field=IntegerField()), Value(0)),
        _count_draft=_count_subq(Q(is_released=False)),
        _count_available=_count_subq(Q(is_released=True) & Q(sales__isnull=True)),
        _count_on_hold=_count_subq(Q(is_released=True) & Q(sales__status__in=["on_hold", "pending", "declined"])),
        _count_reserved=_count_subq(Q(is_released=True) & Q(sales__status__in=["reserved", "contract_issued", "exchanged"])),
        _count_settled=_count_subq(Q(is_released=True) & Q(sales__status="settled")),
    )


def _log_activity(da, event_type, description, user=None):
    try:
        from apps.projects.models import DAActivityLog
        DAActivityLog.objects.create(da=da, event_type=event_type, description=description, created_by=user)
    except Exception:
        pass


class ProjectAgencySerializer(serializers.ModelSerializer):
    agency_id        = serializers.UUIDField(source="agency.id", read_only=True)
    agency_name      = serializers.CharField(source="agency.name", read_only=True)
    assigned_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = ProjectAgency
        fields = ["id", "agency_id", "agency_name", "assigned_by_name", "assigned_at"]

    def get_assigned_by_name(self, obj):
        if obj.assigned_by:
            return f"{obj.assigned_by.first_name} {obj.assigned_by.last_name}".strip()
        return None


class LotAgencySerializer(serializers.ModelSerializer):
    agency_id        = serializers.UUIDField(source="agency.id", read_only=True)
    agency_name      = serializers.CharField(source="agency.name", read_only=True)
    assigned_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = LotAgency
        fields = ["id", "agency_id", "agency_name", "assigned_by_name", "assigned_at"]

    def get_assigned_by_name(self, obj):
        if obj.assigned_by:
            return f"{obj.assigned_by.first_name} {obj.assigned_by.last_name}".strip()
        return None


class ProjectViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    def get_queryset(self):
        org = self.request.user.organisation
        qs = Project.objects.filter(organisation=org).select_related("solicitor").prefetch_related("stages", "media").order_by("name")
        qs = AgencyScope.filter_projects(self.request.user, qs)
        status_param = self.request.query_params.get("status")
        if status_param in ("active", "draft", "completed"):
            qs = qs.filter(status=status_param)
        if self.action == "list":
            qs = _annotate_lot_status_counts(qs)
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProjectDetailSerializer
        return ProjectListSerializer

    @action(detail=True, methods=["get", "post"], url_path="media", parser_classes=[MultiPartParser, FormParser], permission_classes=[HasPermission("project.manage_media")])
    def media(self, request, pk=None):
        project = self.get_object()
        if request.method == "GET":
            return Response(ProjectMediaSerializer(project.media.all(), many=True, context={"request": request}).data)
        serializer = ProjectMediaUploadSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project, uploaded_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="agencies")
    def agencies(self, request, pk=None):
        project = self.get_object()
        if request.method == "GET":
            if AgencyScope.is_agency_user(request.user):
                agency = AgencyScope.get_agency(request.user)
                qs = ProjectAgency.objects.filter(project=project, agency=agency)
            else:
                qs = ProjectAgency.objects.filter(project=project).select_related("agency", "assigned_by")
            return Response(ProjectAgencySerializer(qs, many=True).data)
        if AgencyScope.is_agency_user(request.user):
            return Response({"error": "permission_denied", "detail": "Agency users cannot manage project assignments."}, status=status.HTTP_403_FORBIDDEN)
        agency_id = request.data.get("agency_id")
        if not agency_id:
            return Response({"error": "validation_error", "detail": "agency_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        from apps.contacts.models import Agency
        try:
            agency = Agency.objects.get(id=agency_id, organisation=request.user.organisation)
        except Agency.DoesNotExist:
            return Response({"error": "not_found", "detail": "Agency not found."}, status=status.HTTP_404_NOT_FOUND)
        pa, created = ProjectAgency.objects.get_or_create(project=project, agency=agency, defaults={"assigned_by": request.user})
        if not created:
            return Response({"error": "conflict", "detail": "This agency is already assigned to this project."}, status=status.HTTP_409_CONFLICT)
        return Response(ProjectAgencySerializer(pa).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"agencies/(?P<agency_id>[^/.]+)")
    def remove_agency(self, request, pk=None, agency_id=None):
        if AgencyScope.is_agency_user(request.user):
            return Response({"error": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        project = self.get_object()
        try:
            pa = ProjectAgency.objects.get(project=project, agency_id=agency_id)
        except ProjectAgency.DoesNotExist:
            return Response({"error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if Sale:
            if Sale.objects.filter(lot__stage__project=project, agent__agency_id=agency_id).exclude(status__in=["fallen_over", "settled"]).exists():
                return Response({"error": "conflict", "detail": "This agency has active sales on this project."}, status=status.HTTP_409_CONFLICT)
        pa.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StageViewSet(mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = StageSerializer

    def get_queryset(self):
        org = self.request.user.organisation
        qs = Stage.objects.filter(project__organisation=org).select_related("project").prefetch_related("lots")
        if AgencyScope.is_agency_user(self.request.user):
            from apps.projects.models import ProjectAgency
            agency = AgencyScope.get_agency(self.request.user)
            accessible = ProjectAgency.objects.filter(agency=agency, project__organisation=org).values_list("project_id", flat=True)
            qs = qs.filter(project__in=accessible)
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs.order_by("project", "stage_number")


class LotViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    def get_queryset(self):
        org = self.request.user.organisation
        qs = Lot.objects.filter(stage__project__organisation=org)
        return AgencyScope.filter_lots(self.request.user, qs)

    def get_serializer_class(self):
        from apps.projects.serializers import LotSerializer
        return LotSerializer

    @action(detail=True, methods=["get", "post", "delete"], url_path="assign-agency")
    def assign_agency(self, request, pk=None):
        lot = self.get_object()
        if request.method == "GET":
            try:
                la = LotAgency.objects.select_related("agency", "assigned_by").get(lot=lot)
                return Response(LotAgencySerializer(la).data)
            except LotAgency.DoesNotExist:
                return Response(None)
        if AgencyScope.is_agency_user(request.user):
            return Response({"error": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        if request.method == "DELETE":
            try:
                LotAgency.objects.get(lot=lot).delete()
                return Response(status=status.HTTP_204_NO_CONTENT)
            except LotAgency.DoesNotExist:
                return Response({"error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        agency_id = request.data.get("agency_id")
        if not agency_id:
            return Response({"error": "validation_error", "detail": "agency_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        from apps.contacts.models import Agency
        try:
            agency = Agency.objects.get(id=agency_id, organisation=request.user.organisation)
        except Agency.DoesNotExist:
            return Response({"error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if not ProjectAgency.objects.filter(project=lot.stage.project, agency=agency).exists():
            return Response({"error": "validation_error", "detail": "This agency does not have access to this project."}, status=status.HTTP_400_BAD_REQUEST)
        if Sale:
            if Sale.objects.filter(lot=lot).exclude(status__in=["fallen_over", "settled"]).exclude(agent__agency=agency).exists():
                return Response({"error": "conflict", "detail": "This lot has an active sale by a different agency."}, status=status.HTTP_409_CONFLICT)
        la, created = LotAgency.objects.update_or_create(lot=lot, defaults={"agency": agency, "assigned_by": request.user})
        return Response(LotAgencySerializer(la).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ProjectMediaUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProjectMedia
        fields = ["media_type", "category", "title", "file", "sort_order"]

    def to_representation(self, instance):
        return ProjectMediaSerializer(instance, context=self.context).data


# =============================================================================
# DA & Planning ViewSets
# =============================================================================

from apps.projects.models import DevelopmentApplication, DACondition, DAMilestone, DADocument
from apps.projects.serializers import (
    DevelopmentApplicationSerializer,
    DevelopmentApplicationListSerializer,
    DAConditionSerializer,
    DAMilestoneSerializer,
    DACommentSerializer,
    ConditionCommentSerializer,
    DAActivityLogSerializer,
)


class DADocumentSerializer(serializers.ModelSerializer):
    file_url         = serializers.SerializerMethodField()
    filename         = serializers.SerializerMethodField()
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model  = DADocument
        fields = ["id", "da", "category", "category_display", "title", "file_url", "filename", "uploaded_by", "created_at"]
        read_only_fields = ["id", "da", "uploaded_by", "created_at"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None

    def get_filename(self, obj):
        return obj.filename


class DADocumentUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DADocument
        fields = ["category", "title", "file"]

    def to_representation(self, instance):
        return DADocumentSerializer(instance, context=self.context).data


class DevelopmentApplicationViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        org = self.request.user.organisation
        qs = DevelopmentApplication.objects.filter(
            project__organisation=org
        ).select_related("project", "stage").prefetch_related(
            "conditions__comments", "milestones", "documents", "comments", "activity_log",
        )
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    def get_serializer_class(self):
        return DevelopmentApplicationSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "commit_feasibility"):
            return [HasPermission("da.manage")()]
        return [HasPermission("report.view")()]

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        old_status   = instance.status
        old_owner_id = instance.owner_id
        old_feasibility = (instance.feasibility or {}).get("lines", [])

        response = super().partial_update(request, *args, **kwargs)
        instance.refresh_from_db()

        if instance.status != old_status:
            old_label = dict(DevelopmentApplication.Status.choices).get(old_status, old_status)
            new_label = dict(DevelopmentApplication.Status.choices).get(instance.status, instance.status)
            _log_activity(instance, "status_changed", f"Status changed from '{old_label}' to '{new_label}'", user=request.user)

        if instance.owner_id != old_owner_id:
            if instance.owner:
                owner_name = f"{instance.owner.first_name} {instance.owner.last_name}".strip()
                _log_activity(instance, "owner_assigned", f"Owner assigned to {owner_name}", user=request.user)
            else:
                _log_activity(instance, "owner_assigned", "Owner removed", user=request.user)

        new_feasibility = (instance.feasibility or {}).get("lines", [])
        if new_feasibility != old_feasibility:
            totals = instance.get_feasibility_totals()
            _log_activity(
                instance, "feasibility_updated",
                f"Feasibility updated: {totals['total_lots']} lots, target GR ${totals['total_gr']:,.0f}",
                user=request.user,
            )

        return response

    @action(detail=True, methods=["post"], url_path="commit-feasibility",
            permission_classes=[HasPermission("da.manage")])
    def commit_feasibility(self, request, pk=None):
        from django.utils import timezone
        da = self.get_object()

        if da.feasibility_committed:
            return Response(
                {"error": "already_committed", "detail": "Feasibility has already been committed to this project."},
                status=status.HTTP_409_CONFLICT,
            )

        totals = da.get_feasibility_totals()
        if totals["total_lots"] == 0:
            return Response(
                {"error": "validation_error", "detail": "Add at least one feasibility line before committing."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = da.project
        project.billing_lot_count = totals["total_lots"]
        project.target_gr         = totals["total_gr"]
        project.save(update_fields=["billing_lot_count", "target_gr"])

        da.feasibility_committed    = True
        da.feasibility_committed_at = timezone.now()
        da.save(update_fields=["feasibility_committed", "feasibility_committed_at"])

        _log_activity(
            da, "feasibility_committed",
            f"Feasibility committed to project: {totals['total_lots']} lots, target GR ${totals['total_gr']:,.0f}",
            user=request.user,
        )

        return Response({
            "committed": True,
            "total_lots": totals["total_lots"],
            "total_gr":   totals["total_gr"],
        })

    @action(detail=True, methods=["get", "post"], url_path="documents",
            parser_classes=[MultiPartParser, FormParser],
            permission_classes=[HasPermission("da.manage")])
    def documents(self, request, pk=None):
        da = self.get_object()
        if request.method == "GET":
            return Response(DADocumentSerializer(da.documents.all(), many=True, context={"request": request}).data)
        serializer = DADocumentUploadSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        doc = serializer.save(da=da, uploaded_by=request.user)
        _log_activity(da, "document_uploaded", f"Document uploaded: {doc.title or doc.filename}", user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        da = self.get_object()
        if request.method == "GET":
            return Response(DACommentSerializer(da.comments.all(), many=True).data)
        body = request.data.get("body", "").strip()
        if not body:
            return Response({"error": "validation_error", "detail": "body is required."}, status=status.HTTP_400_BAD_REQUEST)
        from apps.projects.models import DAComment
        comment = DAComment.objects.create(da=da, body=body, created_by=request.user)
        _log_activity(da, "comment_added", f"Comment added by {request.user.first_name} {request.user.last_name}".strip(), user=request.user)
        return Response(DACommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="activity-log")
    def activity_log_endpoint(self, request, pk=None):
        da = self.get_object()
        return Response(DAActivityLogSerializer(da.activity_log.all(), many=True).data)


class DAConditionViewSet(viewsets.ModelViewSet):
    serializer_class = DAConditionSerializer

    def get_queryset(self):
        org = self.request.user.organisation
        qs = DACondition.objects.filter(
            da__project__organisation=org
        ).select_related("da", "responsible_party").prefetch_related("comments")
        da_id = self.request.query_params.get("da")
        if da_id:
            qs = qs.filter(da_id=da_id)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [HasPermission("da.manage")()]
        return [HasPermission("report.view")()]

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        old_status = instance.status
        response = super().partial_update(request, *args, **kwargs)
        instance.refresh_from_db()
        if instance.status != old_status:
            old_label = dict(DACondition.Status.choices).get(old_status, old_status)
            new_label = dict(DACondition.Status.choices).get(instance.status, instance.status)
            cond_ref  = instance.condition_number or f"Condition {str(instance.id)[:8]}"
            _log_activity(instance.da, "condition_status_changed", f"{cond_ref} status changed from '{old_label}' to '{new_label}'", user=request.user)
        return response

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        condition = self.get_object()
        if request.method == "GET":
            return Response(ConditionCommentSerializer(condition.comments.all(), many=True).data)
        body = request.data.get("body", "").strip()
        if not body:
            return Response({"error": "validation_error", "detail": "body is required."}, status=status.HTTP_400_BAD_REQUEST)
        from apps.projects.models import ConditionComment
        comment  = ConditionComment.objects.create(condition=condition, body=body, created_by=request.user)
        cond_ref = condition.condition_number or f"Condition {str(condition.id)[:8]}"
        _log_activity(condition.da, "comment_added", f"Comment added on {cond_ref} by {request.user.first_name} {request.user.last_name}".strip(), user=request.user)
        return Response(ConditionCommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class DAMilestoneViewSet(viewsets.ModelViewSet):
    serializer_class = DAMilestoneSerializer

    def get_queryset(self):
        org = self.request.user.organisation
        qs = DAMilestone.objects.filter(da__project__organisation=org).select_related("da")
        da_id = self.request.query_params.get("da")
        if da_id:
            qs = qs.filter(da_id=da_id)
        return qs

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [HasPermission("da.manage")()]
        return [HasPermission("report.view")()]

    def perform_create(self, serializer):
        instance = serializer.save()
        _log_activity(instance.da, "milestone_added", f"Milestone added: {instance.display_label}", user=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        old_actual = instance.actual_date
        response = super().partial_update(request, *args, **kwargs)
        instance.refresh_from_db()
        if instance.actual_date and not old_actual:
            _log_activity(instance.da, "milestone_updated", f"Milestone completed: {instance.display_label} on {instance.actual_date}", user=request.user)
        return response


class DADocumentViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class   = DADocumentSerializer
    permission_classes = [HasPermission("da.manage")]

    def get_queryset(self):
        org = self.request.user.organisation
        return DADocument.objects.filter(da__project__organisation=org)

    def perform_destroy(self, instance):
        doc_name = instance.title or instance.filename or "Document"
        da = instance.da
        instance.delete()
        _log_activity(da, "document_deleted", f"Document deleted: {doc_name}", user=self.request.user)