"""
apps/projects/serializers.py
"""

from decimal import Decimal
from django.db.models import OuterRef, Subquery, Sum
from rest_framework import serializers

from apps.contacts.models import Solicitor
from apps.projects.models import Lot, LotPriceHistory, Project, ProjectMedia, Stage


# ─────────────────────────────────────────────────────────────────────────────
# ProjectMedia
# ─────────────────────────────────────────────────────────────────────────────

class ProjectMediaSerializer(serializers.ModelSerializer):
    file_url         = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = ProjectMedia
        fields = [
            "id", "media_type", "category", "title",
            "file_url", "sort_order", "uploaded_by_name", "created_at",
        ]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip()
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Solicitor (minimal)
# ─────────────────────────────────────────────────────────────────────────────

class SolicitorMinimalSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model  = Solicitor
        fields = ["id", "full_name", "firm_name", "email", "phone"]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


# ─────────────────────────────────────────────────────────────────────────────
# Lot — summary (nested in stage)
# ─────────────────────────────────────────────────────────────────────────────

class LotSummarySerializer(serializers.ModelSerializer):
    status        = serializers.SerializerMethodField()
    current_price = serializers.SerializerMethodField()

    class Meta:
        model  = Lot
        fields = [
            "id", "lot_number", "lot_type",
            "bedrooms", "bathrooms", "car_spaces",
            "land_area", "floor_area", "aspect", "level", "building",
            "status", "current_price",
        ]

    def get_status(self, obj):
        return obj.status

    def get_current_price(self, obj):
        # Use prefetched cache — avoid re-querying DB per lot
        records = list(obj.price_history.all())
        if not records:
            return None
        record = max(records, key=lambda r: (r.effective_date, r.created_at))
        return record.price


# ─────────────────────────────────────────────────────────────────────────────
# Lot — full (used by LotViewSet)
# ─────────────────────────────────────────────────────────────────────────────

class LotSerializer(serializers.ModelSerializer):
    status        = serializers.SerializerMethodField()
    current_price = serializers.SerializerMethodField()
    stage_name    = serializers.CharField(source="stage.name", read_only=True)
    project_name  = serializers.CharField(source="stage.project.name", read_only=True)
    project_id    = serializers.UUIDField(source="stage.project.id", read_only=True)

    class Meta:
        model  = Lot
        fields = [
            "id", "lot_number", "lot_type",
            "bedrooms", "bathrooms", "car_spaces",
            "land_area", "floor_area", "aspect", "level", "building",
            "inclusions", "floor_plan_url", "is_released",
            "status", "current_price",
            "stage_name", "project_name", "project_id",
            "created_at",
        ]

    def get_status(self, obj):
        return getattr(obj, "computed_status", None) or obj.status

    def get_current_price(self, obj):
        # Use prefetched cache — avoid re-querying DB per lot
        records = list(obj.price_history.all())
        if not records:
            return None
        record = max(records, key=lambda r: (r.effective_date, r.created_at))
        return record.price


# ─────────────────────────────────────────────────────────────────────────────
# Stage
# ─────────────────────────────────────────────────────────────────────────────

class StageSerializer(serializers.ModelSerializer):
    lots      = LotSummarySerializer(many=True, read_only=True)
    lot_count = serializers.IntegerField(source="lots.count", read_only=True)

    class Meta:
        model  = Stage
        fields = [
            "id", "name", "stage_number", "expected_release",
            "lot_count", "lots",
        ]


# ─────────────────────────────────────────────────────────────────────────────
# GR helper — two aggregation queries, no Python loops
# ─────────────────────────────────────────────────────────────────────────────

def _calculate_project_gr(project) -> str | None:
    """
    Calculates project GR using two DB aggregation queries:
      1. Unsettled lots → sum of each lot's most recent LotPriceHistory price
      2. Settled lots   → sum of sale_price on the settled Sale
    """
    from apps.sales.models import Sale

    latest_price_sq = (
        LotPriceHistory.objects
        .filter(lot=OuterRef("pk"))
        .order_by("-effective_date", "-created_at")
        .values("price")[:1]
    )

    lots_qs = Lot.objects.filter(stage__project=project).annotate(
        latest_price=Subquery(latest_price_sq)
    )

    settled_lot_ids = (
        Sale.objects
        .filter(lot__stage__project=project, status="settled")
        .values_list("lot_id", flat=True)
    )

    unsettled_gr = (
        lots_qs
        .exclude(id__in=settled_lot_ids)
        .aggregate(total=Sum("latest_price"))
    )["total"] or Decimal("0")

    settled_gr = (
        Sale.objects
        .filter(lot__stage__project=project, status="settled")
        .aggregate(total=Sum("sale_price"))
    )["total"] or Decimal("0")

    total = Decimal(str(unsettled_gr)) + Decimal(str(settled_gr))
    return str(total) if total else None


# ─────────────────────────────────────────────────────────────────────────────
# Lot counts helper — DB aggregation, no Python loops
# ─────────────────────────────────────────────────────────────────────────────

def _calculate_lot_counts(project) -> dict:
    """
    Returns lot status counts for a project using DB count queries.
    No Python iteration over lots — safe regardless of lot count.
    """
    lots = Lot.objects.filter(stage__project=project)

    return {
        "total":     lots.count(),
        "draft":     lots.filter(is_released=False).count(),
        "available": lots.filter(is_released=True, sales__isnull=True).count(),
        "on_hold":   lots.filter(
                         is_released=True,
                         sales__status__in=["on_hold", "pending", "declined"]
                     ).count(),
        "reserved":  lots.filter(
                         is_released=True,
                         sales__status__in=["reserved", "contract_issued", "exchanged"]
                     ).count(),
        "settled":   lots.filter(sales__status="settled").count(),
        "total_gr":  _calculate_project_gr(project),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Project — list (tile grid)
# ─────────────────────────────────────────────────────────────────────────────

class ProjectListSerializer(serializers.ModelSerializer):
    lot_counts     = serializers.SerializerMethodField()
    stage_count    = serializers.IntegerField(source="stages.count", read_only=True)
    hero_image_url = serializers.SerializerMethodField()
    total_gr       = serializers.SerializerMethodField()

    class Meta:
        model  = Project
        fields = [
            "id", "name", "address", "status",
            "tagline", "website_url",
            "billing_lot_count", "billing_start_date", "billing_end_date",
            "billing_status",
            "stage_count", "lot_counts", "total_gr", "hero_image_url",
            "created_at",
        ]

    def get_lot_counts(self, obj):
        # Counts come from DB annotations applied in the view — no extra queries
        return {
            "total":     getattr(obj, "_count_total",     0),
            "draft":     getattr(obj, "_count_draft",     0),
            "available": getattr(obj, "_count_available", 0),
            "on_hold":   getattr(obj, "_count_on_hold",   0),
            "reserved":  getattr(obj, "_count_reserved",  0),
            "settled":   getattr(obj, "_count_settled",   0),
            "total_gr":  None,  # use top-level total_gr field instead
        }

    def get_total_gr(self, obj):
        return _calculate_project_gr(obj)

    def get_hero_image_url(self, obj):
        hero = obj.media.filter(category="hero", media_type="image").first()
        if not hero:
            return None
        request = self.context.get("request")
        if hero.file and request:
            return request.build_absolute_uri(hero.file.url)
        return hero.file.url if hero.file else None


# ─────────────────────────────────────────────────────────────────────────────
# Project — detail (drill-down)
# ─────────────────────────────────────────────────────────────────────────────

class ProjectDetailSerializer(serializers.ModelSerializer):
    stages     = StageSerializer(many=True, read_only=True)
    media      = serializers.SerializerMethodField()
    solicitor  = SolicitorMinimalSerializer(read_only=True)
    lot_counts = serializers.SerializerMethodField()

    class Meta:
        model  = Project
        fields = [
            "id", "name", "address", "status",
            "tagline", "description", "website_url",
            "solicitor",
            "billing_lot_count", "billing_start_date", "billing_end_date",
            "billing_status",
            "lot_counts", "stages", "media",
            "created_at",
        ]

    def get_lot_counts(self, obj):
        # Pure DB aggregation — no Python lot iteration
        return _calculate_lot_counts(obj)

    def get_media(self, obj):
        grouped = {k: [] for k in ("hero", "gallery", "brochure", "site_map", "floor_plan", "other")}
        for item in ProjectMediaSerializer(obj.media.all(), many=True, context=self.context).data:
            cat = item.get("category", "other")
            if cat in grouped:
                grouped[cat].append(item)
            else:
                grouped["other"].append(item)
        return grouped


# ─────────────────────────────────────────────────────────────────────────────
# Project — full (used by ProjectViewSet create/update)
# ─────────────────────────────────────────────────────────────────────────────

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Project
        fields = [
            "id", "name", "address", "status",
            "tagline", "description", "website_url",
            "billing_lot_count", "billing_start_date", "billing_end_date",
            "billing_status", "created_at",
        ]


# ─────────────────────────────────────────────────────────────────────────────
# LotPriceHistory (used by LotViewSet price_history + update_price actions)
# ─────────────────────────────────────────────────────────────────────────────

class LotPriceHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = LotPriceHistory
        fields = ["id", "price", "effective_date", "reason", "changed_by_name", "created_at"]

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return f"{obj.changed_by.first_name} {obj.changed_by.last_name}".strip()
        return None