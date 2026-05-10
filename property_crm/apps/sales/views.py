"""
apps/sales/views.py

Workflow actions are dedicated POST endpoints — not PATCH on status.
Each transition has side effects that must execute atomically via services.py.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import HasPermission
from .models import Sale, Commission
from .serializers import (
    SaleSerializer, SaleCreateSerializer,
    SubmitForApprovalSerializer, FallOverSerializer,
    ProgressSerializer, DeclineSerializer, CommissionSerializer,
)
from . import services


class SaleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    http_method_names  = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = (
            Sale.objects
            .for_org(self.request.user.organisation)
            .select_related(
                "lot__stage__project",
                "primary_buyer",
                "secondary_buyer",
                "agent__agency",
                "solicitor",
                "referrer",
                "created_by",
                "approved_by",
            )
            .prefetch_related("deposit", "commission")
        )

        # External agents see only their own sales
        if self.request.user.is_external_agent:
            qs = qs.filter(agent=self.request.user.agent)

        # Optional filters
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("lot"):
            qs = qs.filter(lot_id=params["lot"])
        if params.get("agent"):
            qs = qs.filter(agent_id=params["agent"])

        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return SaleCreateSerializer
        return SaleSerializer

    def create(self, request):
        """POST /sales/ — create a Sale at On Hold status."""
        serializer = SaleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        org = request.user.organisation

        # Resolve FK objects — all must belong to this org
        from apps.projects.models import Lot
        from apps.contacts.models import Buyer, Agent, Referrer

        try:
            lot = Lot.objects.get(pk=d["lot_id"], stage__project__organisation=org)
        except Lot.DoesNotExist:
            return Response({"error": "not_found", "detail": "Lot not found."}, status=404)

        if lot.status != "available":
            return Response(
                {"error": "bad_request", "detail": f"Lot is not available (current status: {lot.status})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            primary_buyer = Buyer.objects.get(pk=d["primary_buyer_id"], organisation=org)
        except Buyer.DoesNotExist:
            return Response({"error": "not_found", "detail": "Buyer not found."}, status=404)

        kwargs = {
            "cooling_off_waived": d.get("cooling_off_waived", False),
            "subject_to_finance": d.get("subject_to_finance", False),
            "finance_due_date":   d.get("finance_due_date"),
        }
        if d.get("secondary_buyer_id"):
            kwargs["secondary_buyer"] = Buyer.objects.get(pk=d["secondary_buyer_id"], organisation=org)
        if d.get("agent_id"):
            kwargs["agent"] = Agent.objects.get(pk=d["agent_id"], organisation=org)
        if d.get("referrer_id"):
            kwargs["referrer"] = Referrer.objects.get(pk=d["referrer_id"], organisation=org)

        sale = services.create_sale(
            lot=lot,
            primary_buyer=primary_buyer,
            created_by=request.user,
            organisation=org,
            **kwargs,
        )
        return Response(SaleSerializer(sale, context={"request": request}).data, status=status.HTTP_201_CREATED)

    # ------------------------------------------------------------------
    # Workflow action endpoints
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """POST /sales/{id}/submit/ — Workflow 02: On Hold / Declined → Pending."""
        sale = self.get_object()

        if sale.status not in (Sale.Status.ON_HOLD, Sale.Status.DECLINED):
            return Response(
                {"error": "bad_request", "detail": "Sale must be On Hold or Declined to submit."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SubmitForApprovalSerializer(data=request.data, files=request.FILES)
        serializer.is_valid(raise_exception=True)

        sale = services.submit_for_approval(
            sale=sale,
            deposit_data=serializer.validated_data,
            user=request.user,
        )
        return Response(SaleSerializer(sale, context={"request": request}).data)

    @action(
        detail=True, methods=["post"],
        permission_classes=[IsAuthenticated, HasPermission("sale.approve")],
    )
    def approve(self, request, pk=None):
        """POST /sales/{id}/approve/ — Workflow 03: Pending → Reserved."""
        sale = self.get_object()
        sale = services.approve_sale(sale=sale, approved_by=request.user)
        return Response(SaleSerializer(sale, context={"request": request}).data)

    @action(
        detail=True, methods=["post"],
        permission_classes=[IsAuthenticated, HasPermission("sale.approve")],
    )
    def decline(self, request, pk=None):
        """POST /sales/{id}/decline/ — Workflow 03: Pending → Declined."""
        sale = self.get_object()
        serializer = DeclineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sale = services.decline_sale(
            sale=sale,
            reason=serializer.validated_data["reason"],
            declined_by=request.user,
        )
        return Response(SaleSerializer(sale, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def progress(self, request, pk=None):
        """POST /sales/{id}/progress/ — Workflow 04: Reserved → ... → Settled."""
        sale = self.get_object()
        serializer = ProgressSerializer(data={**request.data, **request.FILES})
        serializer.is_valid(raise_exception=True)
        sale = services.progress_sale(
            sale=sale,
            date_value=serializer.validated_data["date_value"],
            file_value=serializer.validated_data["file_value"],
            progressed_by=request.user,
        )
        return Response(SaleSerializer(sale, context={"request": request}).data)

    @action(
        detail=True, methods=["post"],
        permission_classes=[IsAuthenticated, HasPermission("sale.approve")],
    )
    def fall_over(self, request, pk=None):
        """POST /sales/{id}/fall_over/ — Workflow 05: Any active status → Fallen Over."""
        sale = self.get_object()
        serializer = FallOverSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sale = services.fall_over_sale(
            sale=sale,
            reason=serializer.validated_data["reason"],
            fallen_by=request.user,
        )
        return Response(SaleSerializer(sale, context={"request": request}).data)


class CommissionViewSet(viewsets.ModelViewSet):
    serializer_class   = CommissionSerializer
    permission_classes = [IsAuthenticated, HasPermission("sale.approve")]
    http_method_names  = ["get", "patch", "head", "options"]

    def get_queryset(self):
        return (
            Commission.objects
            .for_org(self.request.user.organisation)
            .select_related("sale__lot__stage__project", "agent__agency", "approved_by")
        )

    def partial_update(self, request, *args, **kwargs):
        """PATCH /commissions/{id}/ — Sales Manager sets type, rate, and calculates."""
        commission = self.get_object()
        serializer = CommissionSerializer(commission, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        commission = serializer.save()
        commission.calculate()
        commission.save(update_fields=["calculated_amount"])
        return Response(CommissionSerializer(commission).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """POST /commissions/{id}/approve/"""
        from django.utils import timezone
        commission = self.get_object()
        if commission.status != Commission.CommissionStatus.PENDING:
            return Response(
                {"error": "bad_request", "detail": "Commission is not pending."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        commission.status      = Commission.CommissionStatus.APPROVED
        commission.approved_by = request.user
        commission.approved_at = timezone.now()
        commission.save(update_fields=["status", "approved_by", "approved_at"])
        return Response(CommissionSerializer(commission).data)

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        """POST /commissions/{id}/mark_paid/"""
        from django.utils import timezone
        commission = self.get_object()
        if commission.status != Commission.CommissionStatus.APPROVED:
            return Response(
                {"error": "bad_request", "detail": "Commission must be approved before marking paid."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        commission.status  = Commission.CommissionStatus.PAID
        commission.paid_at = timezone.now()
        commission.save(update_fields=["status", "paid_at"])
        return Response(CommissionSerializer(commission).data)
