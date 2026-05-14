"""
apps/activities/serializers.py
"""

from rest_framework import serializers
from .models import Activity


class ActivitySerializer(serializers.ModelSerializer):
    is_complete       = serializers.BooleanField(read_only=True)
    assigned_to_name  = serializers.CharField(source="assigned_to.get_full_name", read_only=True)
    created_by_name   = serializers.CharField(source="created_by.get_full_name", read_only=True)
    contact_type      = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    contact_id        = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model  = Activity
        fields = [
            "id", "activity_type", "subject", "description", "activity_date",
            "contact_type", "contact_id",
            "sale",
            "assigned_to", "assigned_to_name",
            "created_by", "created_by_name",
            "due_date", "completed_at", "is_complete",
            "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "is_complete"]

    def create(self, validated_data):
        validated_data["organisation"] = self.context["request"].user.organisation
        validated_data["created_by"]   = self.context["request"].user
        if not validated_data.get("assigned_to"):
            validated_data["assigned_to"] = self.context["request"].user
        return super().create(validated_data)