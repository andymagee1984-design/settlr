"""
apps/contacts/serializers.py
"""

from rest_framework import serializers
from .models import Buyer, Agency, Agent, Solicitor, Referrer


class BuyerSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model  = Buyer
        fields = [
            "id", "buyer_type", "display_name",
            "first_name", "last_name", "date_of_birth", "occupation",
            "entity_name", "abn", "trustee_name",
            "email", "phone", "address",
            "investment_intent", "marketing_opt_in", "id_verified",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        validated_data["organisation"] = self.context["request"].user.organisation
        return super().create(validated_data)


class AgencySerializer(serializers.ModelSerializer):
    class Meta:
        model  = Agency
        fields = ["id", "name", "address", "phone", "email", "created_at"]
        read_only_fields = ["id", "created_at"]

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
