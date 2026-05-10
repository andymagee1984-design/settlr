"""
apps/projects/serializers.py
"""

from rest_framework import serializers
from .models import Project, ProjectMedia, Stage, Lot, LotPriceHistory


class LotPriceHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source="changed_by.get_full_name", read_only=True)

    class Meta:
        model  = LotPriceHistory
        fields = ["id", "price", "effective_date", "reason", "changed_by", "changed_by_name", "created_at"]
        read_only_fields = ["id", "changed_by", "created_at"]


class LotSerializer(serializers.ModelSerializer):
    status        = serializers.CharField(read_only=True)
    current_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    stage_name    = serializers.CharField(source="stage.name", read_only=True)
    project_name  = serializers.CharField(source="stage.project.name", read_only=True)

    class Meta:
        model  = Lot
        fields = [
            "id", "stage", "stage_name", "project_name",
            "lot_number", "lot_type", "status", "is_released",
            "bedrooms", "bathrooms", "car_spaces",
            "land_area", "floor_area", "aspect", "level", "building",
            "inclusions", "floor_plan_url", "current_price",
            "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]


class StageSerializer(serializers.ModelSerializer):
    lots = LotSerializer(many=True, read_only=True)

    class Meta:
        model  = Stage
        fields = ["id", "project", "name", "stage_number", "expected_release", "lots"]
        read_only_fields = ["id"]


class ProjectMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProjectMedia
        fields = ["id", "media_type", "category", "title", "file", "sort_order", "created_at"]
        read_only_fields = ["id", "created_at"]


class ProjectSerializer(serializers.ModelSerializer):
    stages = StageSerializer(many=True, read_only=True)
    media  = ProjectMediaSerializer(many=True, read_only=True)

    class Meta:
        model  = Project
        fields = [
            "id", "name", "address", "status",
            "tagline", "description", "website_url", "solicitor",
            "billing_lot_count", "billing_start_date", "billing_end_date", "billing_status",
            "stages", "media", "created_at",
        ]
        read_only_fields = ["id", "billing_lot_count", "billing_start_date", "billing_end_date", "created_at"]

    def create(self, validated_data):
        validated_data["organisation"] = self.context["request"].user.organisation
        return super().create(validated_data)


class ProjectListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — no nested stages."""

    class Meta:
        model  = Project
        fields = [
            "id", "name", "address", "status", "billing_status",
            "billing_lot_count", "billing_start_date", "billing_end_date",
            "created_at",
        ]
