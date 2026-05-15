"""
apps/contacts/serializers.py
"""

from rest_framework import serializers
from .models import Buyer, Agency, Agent, Solicitor, Referrer, Prospect, EnquiryForm


class BuyerSerializer(serializers.ModelSerializer):
    display_name     = serializers.CharField(read_only=True)
    is_converted     = serializers.BooleanField(read_only=True)
    purchase_history = serializers.SerializerMethodField()

    class Meta:
        model  = Buyer
        fields = [
            "id", "buyer_type", "display_name", "is_converted", "is_return_buyer",
            "first_name", "last_name", "date_of_birth", "occupation",
            "entity_name", "abn", "trustee_name",
            "email", "phone", "address",
            "interest_level", "budget_min", "budget_max",
            "preferred_lot_type", "source", "notes",
            "investment_intent", "marketing_opt_in", "id_verified",
            "converted_at", "created_at",
            "purchase_history",
        ]
        read_only_fields = ["id", "converted_at", "created_at", "is_return_buyer"]

    def get_purchase_history(self, obj):
        from django.db.models import Q
        try:
            from apps.sales.models import Sale
        except ImportError:
            return []

        sales = Sale.objects.filter(
            Q(primary_buyer=obj) | Q(secondary_buyer=obj)
        ).select_related("lot__stage__project").order_by("-created_at")

        result = []
        for sale in sales:
            result.append({
                "sale_id":      str(sale.id),
                "project_name": sale.lot.stage.project.name,
                "lot_number":   sale.lot.lot_number,
                "sale_price":   str(sale.sale_price) if sale.sale_price else None,
                "status":       sale.status,
                "settled_at":   sale.settled_at,
                "created_at":   sale.created_at,
            })
        return result

    def create(self, validated_data):
        validated_data["organisation"] = self.context["request"].user.organisation
        return super().create(validated_data)


class AgencySerializer(serializers.ModelSerializer):
    agent_count = serializers.SerializerMethodField()

    class Meta:
        model  = Agency
        fields = [
            "id", "name", "address", "phone", "email",
            "default_commission_type", "default_commission_rate",
            "agent_count", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_agent_count(self, obj):
        return obj.agents.count()

    def create(self, validated_data):
        validated_data["organisation"] = self.context["request"].user.organisation
        return super().create(validated_data)


class AgentSerializer(serializers.ModelSerializer):
    agency_name = serializers.CharField(source="agency.name", read_only=True)

    class Meta:
        model  = Agent
        fields = ["id", "agency", "agency_name", "first_name", "last_name", "email", "phone", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        validated_data["organisation"] = self.context["request"].user.organisation
        return super().create(validated_data)


class SolicitorSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Solicitor
        fields = ["id", "first_name", "last_name", "firm_name", "email", "phone", "address", "created_at"]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        validated_data["organisation"] = self.context["request"].user.organisation
        return super().create(validated_data)


class ReferrerSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Referrer
        fields = ["id", "first_name", "last_name", "company_name", "email", "phone", "created_at"]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        validated_data["organisation"] = self.context["request"].user.organisation
        return super().create(validated_data)


# ─────────────────────────────────────────────────────────────────────────────
# Prospect
# ─────────────────────────────────────────────────────────────────────────────

class ProspectSerializer(serializers.ModelSerializer):
    """
    Full prospect serializer — used for list and detail views.
    Includes derived fields: full_name, engagement_level, returning buyer summary.
    """
    full_name               = serializers.CharField(read_only=True)
    engagement_level        = serializers.CharField(read_only=True)
    assigned_to_name        = serializers.SerializerMethodField()
    project_name            = serializers.SerializerMethodField()
    lot_number              = serializers.SerializerMethodField()
    returning_buyer_summary = serializers.SerializerMethodField()

    class Meta:
        model  = Prospect
        fields = [
            "id", "full_name", "first_name", "last_name", "email", "phone",
            "source", "status", "lost_reason",
            "project", "project_name", "lot", "lot_number",
            "assigned_to", "assigned_to_name",
            "notes",
            "budget_min", "budget_max",
            "purchase_intent",
            "is_returning_buyer", "buyer", "returning_buyer_summary",
            "engagement_level",
            "converted_at", "created_at",
        ]
        read_only_fields = [
            "id", "is_returning_buyer", "buyer",
            "converted_at", "created_at",
        ]

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip()
        return None

    def get_project_name(self, obj):
        return obj.project.name if obj.project else None

    def get_lot_number(self, obj):
        return obj.lot.lot_number if obj.lot else None

    def get_returning_buyer_summary(self, obj):
        if not obj.is_returning_buyer or not obj.buyer:
            return None
        try:
            from django.db.models import Q
            from apps.sales.models import Sale
            latest_sale = Sale.objects.filter(
                Q(primary_buyer=obj.buyer) | Q(secondary_buyer=obj.buyer)
            ).select_related("lot__stage__project").order_by("-created_at").first()

            if not latest_sale:
                return None

            return {
                "project_name": latest_sale.lot.stage.project.name,
                "lot_number":   latest_sale.lot.lot_number,
                "status":       latest_sale.status,
                "sale_price":   str(latest_sale.sale_price) if latest_sale.sale_price else None,
                "created_at":   latest_sale.created_at,
            }
        except Exception:
            return None

    def create(self, validated_data):
        organisation = self.context["request"].user.organisation
        validated_data["organisation"] = organisation

        matched_buyer = Prospect.match_returning_buyer(
            organisation=organisation,
            email=validated_data.get("email", ""),
            first_name=validated_data.get("first_name", ""),
        )
        if matched_buyer:
            validated_data["is_returning_buyer"] = True
            validated_data["buyer"] = matched_buyer

        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Prevent overwriting returning buyer detection fields via PATCH
        validated_data.pop("is_returning_buyer", None)
        validated_data.pop("buyer", None)
        return super().update(instance, validated_data)


class ProspectSearchSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for prospect search results — used in the
    sale creation flow when an agent searches for a prospect to link.
    """
    full_name        = serializers.CharField(read_only=True)
    engagement_level = serializers.CharField(read_only=True)
    project_name     = serializers.SerializerMethodField()

    class Meta:
        model  = Prospect
        fields = [
            "id", "full_name", "first_name", "last_name", "email", "phone",
            "source", "status", "engagement_level",
            "project", "project_name",
            "is_returning_buyer",
            "created_at",
        ]

    def get_project_name(self, obj):
        return obj.project.name if obj.project else None


class PublicEnquirySerializer(serializers.Serializer):
    """
    Write-only serializer for the public enquiry form endpoint.
    No authentication — validates inbound data and creates a Prospect.
    """
    first_name = serializers.CharField(max_length=100)
    last_name  = serializers.CharField(max_length=100)
    email      = serializers.EmailField()
    phone      = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    lot_id     = serializers.UUIDField(required=False, allow_null=True, default=None)
    message    = serializers.CharField(required=False, allow_blank=True, default="")