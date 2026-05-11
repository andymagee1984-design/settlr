"""
apps/projects/views.py

ViewSets for the Projects feature.

Routes (add to config/urls.py or apps/projects/urls.py):
    router.register(r"projects", ProjectViewSet, basename="project")
    router.register(r"stages",   StageViewSet,   basename="stage")
    router.register(r"lots",     LotViewSet,     basename="lot")

This gives you:
    GET  /api/v1/projects/               → tile list with lot status counts
    GET  /api/v1/projects/{id}/          → full detail with stages, lots, media
    GET  /api/v1/projects/{id}/media/    → media list for a project (for upload UI)
    POST /api/v1/projects/{id}/media/    → upload new media item (platform team only)
"""

from django.db import models as django_models
from django.db.models import Count, IntegerField, OuterRef, Prefetch, Q, Subquery, Value
from django.db.models.functions import Coalesce
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import HasPermission
from apps.projects.models import Lot, LotPriceHistory, Project, ProjectMedia, Stage
from apps.projects.serializers import (
    LotPriceHistorySerializer,
    LotSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
    ProjectMediaSerializer,
    ProjectSerializer,
    StageSerializer,
)
from apps.sales.models import Sale


# ─────────────────────────────────────────────────────────────────────────────
# Lot status count annotation helpers
# ─────────────────────────────────────────────────────────────────────────────

def _annotate_lot_status_counts(project_qs):
    """
    Annotate each Project in the queryset with _count_* attributes for
    each derived lot status. Uses a single annotation pass over Lot rows —
    avoids N+1 on the lot → sale join.
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
# Prefetch helpers
# ─────────────────────────────────────────────────────────────────────────────

def _lots_prefetch():
    """
    Prefetch lots with price_history and sales.
    Only used on retrieve (detail view) — not needed for list.
    """
    return Prefetch(
        "stages__lots",
        queryset=Lot.objects.prefetch_related(
            Prefetch(
                "price_history",
                queryset=LotPriceHistory.objects.order_by("-effective_date", "-created_at"),
            ),
            Prefetch(
                "sales",
                queryset=Sale.objects.all(),
            ),
        ),
    )


# ─────────────────────────────────────────────────────────────────────────────
# ProjectViewSet
# ─────────────────────────────────────────────────────────────────────────────

class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        org = self.request.user.organisation
        qs = (
            Project.objects
            .for_org(org)
            .select_related("solicitor")
            .prefetch_related("stages", "media")
            .order_by("name")
        )

        # Only prefetch lots on detail view — list doesn't need them
        if self.action == "retrieve":
            qs = qs.prefetch_related(_lots_prefetch())

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
        if self.action == "list":
            return ProjectListSerializer
        return ProjectSerializer

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, HasPermission("project.activate")],
    )
    def activate(self, request, pk=None):
        project = self.get_object()
        if project.status != "draft":
            return Response(
                {"error": "bad_request", "detail": "Only draft projects can be activated."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        project.activate()
        return Response(ProjectSerializer(project, context={"request": request}).data)

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
        """
        project = self.get_object()

        if request.method == "GET":
            serializer = ProjectMediaSerializer(
                project.media.all(), many=True, context={"request": request}
            )
            return Response(serializer.data)

        serializer = ProjectMediaUploadSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project, uploaded_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────────────────────────────────────────
# StageViewSet
# ─────────────────────────────────────────────────────────────────────────────

class StageViewSet(viewsets.ModelViewSet):
    serializer_class   = StageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Stage.objects.filter(
            project__organisation=self.request.user.organisation
        ).select_related("project")


# ─────────────────────────────────────────────────────────────────────────────
# LotViewSet
# ─────────────────────────────────────────────────────────────────────────────

class LotViewSet(viewsets.ModelViewSet):
    serializer_class   = LotSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            Lot.objects
            .with_status()
            .filter(stage__project__organisation=self.request.user.organisation)
            .select_related("stage__project")
        )

        # External agents only see available lots (and lots tied to their own sales)
        if self.request.user.is_external_agent:
            agent = self.request.user.agent
            own_lot_ids = Sale.objects.filter(agent=agent).values_list("lot_id", flat=True)
            qs = qs.filter(
                django_models.Q(computed_status="available") |
                django_models.Q(id__in=own_lot_ids)
            )

        # Filter by status query param if provided
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(computed_status=status_param)

        return qs

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, HasPermission("lot.edit")],
    )
    def release(self, request, pk=None):
        lot = self.get_object()
        if lot.is_released:
            return Response(
                {"error": "bad_request", "detail": "Lot is already released."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        lot.is_released = True
        lot.save(update_fields=["is_released"])
        return Response(LotSerializer(lot, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def price_history(self, request, pk=None):
        lot = self.get_object()
        history = lot.price_history.select_related("changed_by").all()
        return Response(LotPriceHistorySerializer(history, many=True).data)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, HasPermission("lot.edit")],
    )
    def update_price(self, request, pk=None):
        lot = self.get_object()

        blocked_statuses = [
            "on_hold", "pending", "declined", "reserved",
            "contract_issued", "exchanged", "settled",
        ]
        if lot.status in blocked_statuses:
            msg = (
                "Price cannot be changed on a settled lot."
                if lot.status == "settled"
                else "Price cannot be changed while a sale is active."
            )
            return Response(
                {"error": "bad_request", "detail": msg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = LotPriceHistorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(lot=lot, changed_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────────────────────────────────────────
# Upload serializer (write-only, used by the media POST action)
# ─────────────────────────────────────────────────────────────────────────────

class ProjectMediaUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProjectMedia
        fields = ["media_type", "category", "title", "file", "sort_order"]

    def to_representation(self, instance):
        return ProjectMediaSerializer(instance, context=self.context).data