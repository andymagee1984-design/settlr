"""
apps/projects/views.py
"""

from django.db import models as django_models
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import HasPermission
from .models import Project, Stage, Lot, LotPriceHistory
from .serializers import (
    ProjectSerializer, ProjectListSerializer,
    StageSerializer, LotSerializer, LotPriceHistorySerializer,
)


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Project.objects
            .for_org(self.request.user.organisation)
            .prefetch_related("stages__lots", "media")
        )

    def get_serializer_class(self):
        if self.action == "list":
            return ProjectListSerializer
        return ProjectSerializer

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, HasPermission("project.activate")])
    def activate(self, request, pk=None):
        project = self.get_object()
        if project.status != "draft":
            return Response(
                {"error": "bad_request", "detail": "Only draft projects can be activated."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        project.activate()
        return Response(ProjectSerializer(project, context={"request": request}).data)


class StageViewSet(viewsets.ModelViewSet):
    serializer_class   = StageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Stage.objects.filter(
            project__organisation=self.request.user.organisation
        ).select_related("project")


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
            from apps.sales.models import Sale
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

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, HasPermission("lot.edit")])
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

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, HasPermission("lot.edit")])
    def update_price(self, request, pk=None):
        lot = self.get_object()

        # Block price changes on lots with an active sale or settled
        blocked_statuses = ["on_hold", "pending", "declined", "reserved", "contract_issued", "exchanged", "settled"]
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
