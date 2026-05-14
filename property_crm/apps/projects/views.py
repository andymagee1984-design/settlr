"""
apps/projects/views.py

ViewSets for the Projects feature.

Routes (add to config/urls.py or apps/projects/urls.py):
    router.register(r"projects", ProjectViewSet, basename="project")
    router.register(r"stages",   StageViewSet,   basename="stage")
    router.register(r"lots",     LotViewSet,     basename="lot")

This gives you:
    GET  /api/v1/projects/                              → tile list with lot status counts
    GET  /api/v1/projects/{id}/                         → full detail with stages, lots, media
    GET  /api/v1/projects/{id}/media/                   → media list for a project
    POST /api/v1/projects/{id}/media/                   → upload new media item (platform team only)
    GET  /api/v1/projects/{id}/agencies/                → list agencies assigned to project
    POST /api/v1/projects/{id}/agencies/                → assign an agency to project
    DELETE /api/v1/projects/{id}/agencies/{agency_id}/  → remove agency from project
    GET  /api/v1/lots/{id}/                             → lot detail (agency-scoped)
    POST /api/v1/lots/{id}/assign-agency/               → exclusively assign lot to agency
    DELETE /api/v1/lots/{id}/assign-agency/             → remove exclusive lot assignment
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


# ─────────────────────────────────────────────────────────────────────────────
# Lot status count annotation helpers
# ─────────────────────────────────────────────────────────────────────────────

def _active_sale_status_subquery():
    """
    Subquery: return the status of the single active sale on a lot.
    Active = not fallen_over.
    """
    return (
        Sale.objects
        .filter(lot=OuterRef("pk"))
        .exclude(status="fallen_over")
        .values("status")[:1]
    )


def _annotate_lot_status_counts(project_qs):
    """
    Annotate each Project in the queryset with _count_* attributes for
    each derived lot status. Uses a single annotation pass over Lot rows —
    avoids N+1 on the lot → sale join.

    Derived status logic (mirrors Lot.status @property):
        is_released=False                            → draft
        is_released=True, no active sale             → available
        active sale in (on_hold, pending, declined)  → on_hold
        active sale in (reserved, contract_issued, exchanged) → reserved
        active sale = settled                        → settled
    """
    lots = Lot.objects.filter(stage__project=OuterRef("pk"))

    def _count_subq(filter_q):
        return Coalesce(
            Subquery(
                lots.filter(filter_q)
                .values("stage__project")
                .annotate(n=Count("id"))
                .values("n")[:1],
                output_field=IntegerField(),
            ),
            Value(0),
        )

    return project_qs.annotate(
        _count_total=Coalesce(
            Subquery(
                lots.values("stage__project").annotate(n=Count("id")).values("n")[:1],
                output_field=IntegerField(),
            ),
            Value(0),
        ),
        _count_draft=_count_subq(Q(is_released=False)),
        _count_available=_count_subq(
            Q(is_released=True) & Q(sales__isnull=True)
        ),
        _count_on_hold=_count_subq(
            Q(is_released=True) & Q(sales__status__in=["on_hold", "pending", "declined"])
        ),
        _count_reserved=_count_subq(
            Q(is_released=True) & Q(sales__status__in=["reserved", "contract_issued", "exchanged"])
        ),
        _count_settled=_count_subq(
            Q(is_released=True) & Q(sales__status="settled")
        ),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Inline serializers for agency assignment endpoints
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# ProjectViewSet
# ─────────────────────────────────────────────────────────────────────────────

class ProjectViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    GET /api/v1/projects/        → ProjectListSerializer (tile grid)
    GET /api/v1/projects/{id}/   → ProjectDetailSerializer (drill-down)

    Agency users see only projects where their agency has ProjectAgency access.

    Filtering:
        ?status=active|draft|completed
    """

    def get_queryset(self):
        org = self.request.user.organisation
        qs = (
            Project.objects
            .filter(organisation=org)
            .select_related("solicitor")
            .prefetch_related("stages", "media")
            .order_by("name")
        )

        # Agency scoping — restrict to projects this agency has access to
        qs = AgencyScope.filter_projects(self.request.user, qs)

        # Status filter
        status_param = self.request.query_params.get("status")
        if status_param in ("active", "draft", "completed"):
            qs = qs.filter(status=status_param)

        # Annotate lot status counts for list view
        if self.action == "list":
            qs = _annotate_lot_status_counts(qs)

        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProjectDetailSerializer
        return ProjectListSerializer

    # ─────────────────────────────────────────────────────────────────────────
    # Media endpoints
    # ─────────────────────────────────────────────────────────────────────────

    @action(
        detail=True,
        methods=["get", "post"],
        url_path="media",
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[HasPermission("project.manage_media")],
    )
    def media(self, request, pk=None):
        """
        GET  /api/v1/projects/{id}/media/   — list all media for a project
        POST /api/v1/projects/{id}/media/   — upload a new media item

        POST body (multipart/form-data):
            media_type   image | document
            category     hero | gallery | brochure | site_map | floor_plan | other
            title        Display name
            file         The file to upload
            sort_order   Integer (optional, default 0)
        """
        project = self.get_object()

        if request.method == "GET":
            media_qs = project.media.all()
            serializer = ProjectMediaSerializer(
                media_qs, many=True, context={"request": request}
            )
            return Response(serializer.data)

        # POST — upload
        serializer = ProjectMediaUploadSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project, uploaded_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ─────────────────────────────────────────────────────────────────────────
    # Agency assignment endpoints
    # ─────────────────────────────────────────────────────────────────────────

    @action(
        detail=True,
        methods=["get", "post"],
        url_path="agencies",
    )
    def agencies(self, request, pk=None):
        """
        GET  /api/v1/projects/{id}/agencies/
            List all agencies assigned to this project.

        POST /api/v1/projects/{id}/agencies/
            Assign an agency to this project.
            Body: { "agency_id": "<uuid>" }

        Only developer (internal) users can manage agency assignments.
        Agency users can GET to see who else is assigned (their own record only).
        """
        project = self.get_object()

        if request.method == "GET":
            # Agency users only see their own assignment
            if AgencyScope.is_agency_user(request.user):
                agency = AgencyScope.get_agency(request.user)
                qs = ProjectAgency.objects.filter(project=project, agency=agency)
            else:
                qs = ProjectAgency.objects.filter(project=project).select_related("agency", "assigned_by")
            serializer = ProjectAgencySerializer(qs, many=True)
            return Response(serializer.data)

        # POST — assign agency (internal users only)
        if AgencyScope.is_agency_user(request.user):
            return Response(
                {"error": "permission_denied", "detail": "Agency users cannot manage project assignments."},
                status=status.HTTP_403_FORBIDDEN,
            )

        agency_id = request.data.get("agency_id")
        if not agency_id:
            return Response(
                {"error": "validation_error", "detail": "agency_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify agency belongs to this organisation
        from apps.contacts.models import Agency
        try:
            agency = Agency.objects.get(id=agency_id, organisation=request.user.organisation)
        except Agency.DoesNotExist:
            return Response(
                {"error": "not_found", "detail": "Agency not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        pa, created = ProjectAgency.objects.get_or_create(
            project=project,
            agency=agency,
            defaults={"assigned_by": request.user},
        )
        if not created:
            return Response(
                {"error": "conflict", "detail": "This agency is already assigned to this project."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = ProjectAgencySerializer(pa)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"agencies/(?P<agency_id>[^/.]+)",
    )
    def remove_agency(self, request, pk=None, agency_id=None):
        """
        DELETE /api/v1/projects/{id}/agencies/{agency_id}/
            Remove an agency from a project.

        Blocked if the agency has active sales on this project.
        Internal users only.
        """
        if AgencyScope.is_agency_user(request.user):
            return Response(
                {"error": "permission_denied", "detail": "Agency users cannot manage project assignments."},
                status=status.HTTP_403_FORBIDDEN,
            )

        project = self.get_object()

        try:
            pa = ProjectAgency.objects.get(project=project, agency_id=agency_id)
        except ProjectAgency.DoesNotExist:
            return Response(
                {"error": "not_found", "detail": "Agency assignment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Block removal if agency has active sales on this project
        if Sale:
            active_sales = Sale.objects.filter(
                lot__stage__project=project,
                agent__agency_id=agency_id,
            ).exclude(status__in=["fallen_over", "settled"]).exists()

            if active_sales:
                return Response(
                    {
                        "error": "conflict",
                        "detail": "This agency has active sales on this project. Resolve all active sales before removing agency access.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        pa.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# StageViewSet
# ─────────────────────────────────────────────────────────────────────────────

class StageViewSet(
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    GET /api/v1/stages/           → list stages (filter with ?project=<id>)
    GET /api/v1/stages/{id}/      → stage detail

    Agency users are scoped via project access — they only see stages
    for projects their agency has been assigned to.
    """

    serializer_class = StageSerializer

    def get_queryset(self):
        org = self.request.user.organisation
        qs = Stage.objects.filter(
            project__organisation=org
        ).select_related("project").prefetch_related("lots")

        # Agency scoping — only stages in accessible projects
        if AgencyScope.is_agency_user(self.request.user):
            from apps.projects.models import ProjectAgency
            agency = AgencyScope.get_agency(self.request.user)
            accessible_project_ids = ProjectAgency.objects.filter(
                agency=agency,
                project__organisation=org,
            ).values_list("project_id", flat=True)
            qs = qs.filter(project__in=accessible_project_ids)

        # Optional project filter
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)

        return qs.order_by("project", "stage_number")


# ─────────────────────────────────────────────────────────────────────────────
# LotViewSet
# ─────────────────────────────────────────────────────────────────────────────

class LotViewSet(
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    GET    /api/v1/lots/{id}/               → lot detail (agency-scoped)
    POST   /api/v1/lots/{id}/assign-agency/ → exclusively assign lot to an agency
    DELETE /api/v1/lots/{id}/assign-agency/ → remove exclusive lot assignment
    """

    def get_queryset(self):
        org = self.request.user.organisation
        qs = Lot.objects.filter(stage__project__organisation=org)
        return AgencyScope.filter_lots(self.request.user, qs)

    def get_serializer_class(self):
        from apps.projects.serializers import LotSerializer
        return LotSerializer

    @action(
        detail=True,
        methods=["post", "delete"],
        url_path="assign-agency",
    )
    def assign_agency(self, request, pk=None):
        """
        POST /api/v1/lots/{id}/assign-agency/
            Exclusively assign this lot to an agency.
            Body: { "agency_id": "<uuid>" }

        DELETE /api/v1/lots/{id}/assign-agency/
            Remove the exclusive assignment from this lot.

        Internal users only. Blocked if the lot has an active sale
        by a different agency.
        """
        if AgencyScope.is_agency_user(request.user):
            return Response(
                {"error": "permission_denied", "detail": "Agency users cannot manage lot assignments."},
                status=status.HTTP_403_FORBIDDEN,
            )

        lot = self.get_object()

        if request.method == "DELETE":
            try:
                la = LotAgency.objects.get(lot=lot)
                la.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)
            except LotAgency.DoesNotExist:
                return Response(
                    {"error": "not_found", "detail": "This lot has no exclusive assignment."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # POST — assign exclusively
        agency_id = request.data.get("agency_id")
        if not agency_id:
            return Response(
                {"error": "validation_error", "detail": "agency_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.contacts.models import Agency
        try:
            agency = Agency.objects.get(id=agency_id, organisation=request.user.organisation)
        except Agency.DoesNotExist:
            return Response(
                {"error": "not_found", "detail": "Agency not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Agency must have project-level access first
        if not ProjectAgency.objects.filter(
            project=lot.stage.project,
            agency=agency,
        ).exists():
            return Response(
                {
                    "error": "validation_error",
                    "detail": "This agency does not have access to this project. Assign project access first.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Block if lot has an active sale by a different agency
        if Sale:
            conflicting_sale = Sale.objects.filter(
                lot=lot,
            ).exclude(
                status__in=["fallen_over", "settled"]
            ).exclude(
                agent__agency=agency,
            ).exists()

            if conflicting_sale:
                return Response(
                    {
                        "error": "conflict",
                        "detail": "This lot has an active sale by a different agency. Resolve the sale before reassigning exclusivity.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        # Create or update exclusive assignment
        la, created = LotAgency.objects.update_or_create(
            lot=lot,
            defaults={"agency": agency, "assigned_by": request.user},
        )

        serializer = LotAgencySerializer(la)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Upload serializer (write-only, used by the media POST action)
# ─────────────────────────────────────────────────────────────────────────────

class ProjectMediaUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProjectMedia
        fields = ["media_type", "category", "title", "file", "sort_order"]

    def to_representation(self, instance):
        return ProjectMediaSerializer(instance, context=self.context).data