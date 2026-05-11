"""
apps/sales/serializers.py
"""

from rest_framework import serializers
from .models import Sale, Deposit, Commission


class DepositSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Deposit
        fields = [
            "id", "amount", "deposit_type",
            "deposit_date", "deposit_time", "attachment",
            "created_by", "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_at"]


class CommissionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Commission
        fields = [
            "id", "agent", "commission_type", "rate", "flat_amount",
            "calculated_amount", "incentive_amount", "incentive_notes",
            "status", "approved_by", "approved_at", "paid_at",
        ]
        read_only_fields = ["id", "calculated_amount", "approved_by", "approved_at"]


class SaleSerializer(serializers.ModelSerializer):
    deposit            = DepositSerializer(read_only=True)
    commission         = CommissionSerializer(read_only=True)
    lot_number         = serializers.CharField(source="lot.lot_number", read_only=True)
    project_name       = serializers.CharField(source="lot.stage.project.name", read_only=True)
    project_id         = serializers.UUIDField(source="lot.stage.project.id", read_only=True)
    primary_buyer_name = serializers.CharField(source="primary_buyer.display_name", read_only=True)
    agent_name         = serializers.SerializerMethodField()

    class Meta:
        model  = Sale
        fields = [
            "id", "lot", "lot_number", "project_name", "project_id",
            "primary_buyer", "primary_buyer_name", "secondary_buyer",
            "agent", "agent_name", "solicitor", "referrer",
            "status", "on_hold_expiry",
            "id_verified", "cooling_off_waived", "cooling_off_expiry",
            "subject_to_finance", "finance_due_date",
            "sale_price",
            "created_by", "approved_by", "approved_at",
            "fallen_over_at", "fallen_over_reason",
            "settled_at",
            "contract_issued_date", "exchange_date", "settlement_date",
            "deposit", "commission",
            "created_at",
        ]
        read_only_fields = [
            "id", "status", "on_hold_expiry",
            "approved_by", "approved_at",
            "fallen_over_at", "fallen_over_reason",
            "settled_at", "created_at",
        ]

    def get_agent_name(self, obj) -> str | None:
        if not obj.agent_id:
            return None
        return f"{obj.agent.first_name} {obj.agent.last_name}".strip()


class SaleCreateSerializer(serializers.Serializer):
    """Used by POST /sales/ — creates a sale at On Hold status."""
    lot_id             = serializers.UUIDField()
    primary_buyer_id   = serializers.UUIDField()
    secondary_buyer_id = serializers.UUIDField(required=False, allow_null=True)
    agent_id           = serializers.UUIDField(required=False, allow_null=True)
    referrer_id        = serializers.UUIDField(required=False, allow_null=True)
    cooling_off_waived = serializers.BooleanField(default=False)
    subject_to_finance = serializers.BooleanField(default=False)
    finance_due_date   = serializers.DateField(required=False, allow_null=True)


class SubmitForApprovalSerializer(serializers.Serializer):
    """Body for POST /sales/{id}/submit/"""
    amount         = serializers.DecimalField(max_digits=10, decimal_places=2)
    deposit_type   = serializers.ChoiceField(choices=["eft", "bank_transfer", "other"])
    deposit_date   = serializers.DateField()
    deposit_time   = serializers.TimeField()
    attachment     = serializers.FileField()


class FallOverSerializer(serializers.Serializer):
    """Body for POST /sales/{id}/fall_over/"""
    reason = serializers.ChoiceField(choices=Sale.FallenOverReason.choices)


class ProgressSerializer(serializers.Serializer):
    """Body for POST /sales/{id}/progress/"""
    date_value = serializers.DateField()
    file_value = serializers.FileField()


class DeclineSerializer(serializers.Serializer):
    """Body for POST /sales/{id}/decline/"""
    reason = serializers.CharField(max_length=500)