"""
apps/projects/serializers.py
"""

from decimal import Decimal

from django.db.models import OuterRef, Subquery, Sum
from rest_framework import serializers

from apps.contacts.models import Solicitor
from apps.projects.models import Lot, LotPriceHistory, Project, ProjectMedia, Stage


# ─────────────────────────────────────────────────────────────────────────────
# Amenity definitions
# ─────────────────────────────────────────────────────────────────────────────

AMENITY_DEFINITIONS = [
    {"code": "pool",           "label": "Pool",           "icon": "ti-ripple"},
    {"code": "gym",            "label": "Gym",            "icon": "ti-barbell"},
    {"code": "rooftop_garden", "label": "Rooftop garden", "icon": "ti-plant-2"},
    {"code": "co_working",     "label": "Co-working",     "icon": "ti-briefcase"},
    {"code": "sauna",          "label": "Sauna",          "icon": "ti-flame"},
    {"code": "yoga_studio",    "label": "Yoga studio",    "icon": "ti-heart"},
    {"code": "parking",        "label": "Parking",        "icon": "ti-car-garage"},
    {"code": "pet_area",       "label": "Pet area",       "icon": "ti-dog"},
    {"code": "tennis_court",   "label": "Tennis court",   "icon": "ti-ball-tennis"},
    {"code": "bbq_area",       "label": "BBQ area",       "icon": "ti-flame"},
    {"code": "concierge",      "label": "Concierge",      "icon": "ti-building-skyscraper"},
    {"code": "spa",            "label": "Spa",            "icon": "ti-droplet"},
]

VALID_AMENITY_CODES = {a["code"] for a in AMENITY_DEFINITIONS}


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

def _calculate_project_gr(project):
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
    lots = Lot.objects.filter(stage__project=project)

    on_hold  = lots.filter(
        is_released=True,
        sales__status__in=["on_hold", "pending", "declined"]
    ).count()

    reserved = lots.filter(
        is_released=True,
        sales__status__in=["reserved", "contract_issued", "exchanged"]
    ).count()

    return {
        "total":     lots.count(),
        "draft":     lots.filter(is_released=False).count(),
        "available": lots.filter(is_released=True, sales__isnull=True).count(),
        "on_hold":   on_hold,
        "reserved":  reserved,
        "settled":   lots.filter(sales__status="settled").count(),
        "sold":      on_hold + reserved,
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
        return {
            "total":     getattr(obj, "_count_total",     0),
            "draft":     getattr(obj, "_count_draft",     0),
            "available": getattr(obj, "_count_available", 0),
            "on_hold":   getattr(obj, "_count_on_hold",   0),
            "reserved":  getattr(obj, "_count_reserved",  0),
            "settled":   getattr(obj, "_count_settled",   0),
            "total_gr":  None,
        }

    def get_total_gr(self, obj):
        return _calculate_project_gr(obj)

    def get_hero_image_url(self, obj):
        hero = obj.media.filter(category="hero", media_type="image").first()
        return hero.file.url if hero and hero.file else None


# ─────────────────────────────────────────────────────────────────────────────
# Project — detail (drill-down)
# ─────────────────────────────────────────────────────────────────────────────

class ProjectDetailSerializer(serializers.ModelSerializer):
    stages     = StageSerializer(many=True, read_only=True)
    media      = serializers.SerializerMethodField()
    solicitor  = SolicitorMinimalSerializer(read_only=True)
    lot_counts = serializers.SerializerMethodField()
    amenities  = serializers.SerializerMethodField()

    class Meta:
        model  = Project
        fields = [
            "id", "name", "address", "status",
            "tagline", "description", "website_url",
            "solicitor",
            "billing_lot_count", "billing_start_date", "billing_end_date",
            "billing_status",
            "lot_counts", "stages", "media",
            "amenities",
            "created_at",
        ]

    def get_lot_counts(self, obj):
        return _calculate_lot_counts(obj)

    def get_amenities(self, obj):
        enabled = set(obj.amenities or [])
        return [
            defn for defn in AMENITY_DEFINITIONS
            if defn["code"] in enabled
        ]

    def get_media(self, obj):
        """
        Returns media grouped by category for easy frontend rendering.
        {
          "hero": [...],
          "gallery": [...],
          "brochure": [...],
          "site_map": [...],
          "floor_plan": [...],
          "other": [...]
        }
        """
        all_media = obj.media.all()
        serialized = ProjectMediaSerializer(all_media, many=True, context=self.context).data

        grouped = {
            "hero":       [],
            "gallery":    [],
            "brochure":   [],
            "site_map":   [],
            "floor_plan": [],
            "other":      [],
        }
        for item in serialized:
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

# =============================================================================
# DA & Planning serializers
# =============================================================================

from apps.projects.models import DevelopmentApplication, DACondition, DAMilestone


class DAConditionSerializer(serializers.ModelSerializer):
    responsible_party_name = serializers.SerializerMethodField()
    is_overdue             = serializers.BooleanField(read_only=True)

    class Meta:
        model  = DACondition
        fields = [
            "id", "da", "condition_number", "category", "description",
            "status", "responsible_party", "responsible_party_name",
            "due_date", "completed_date", "notes",
            "is_overdue", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_responsible_party_name(self, obj):
        if obj.responsible_party:
            return obj.responsible_party.get_full_name()
        return None


class DAMilestoneSerializer(serializers.ModelSerializer):
    display_label = serializers.CharField(read_only=True)
    is_overdue    = serializers.BooleanField(read_only=True)

    class Meta:
        model  = DAMilestone
        fields = [
            "id", "da", "milestone_type", "label", "display_label",
            "planned_date", "actual_date", "notes",
            "is_overdue", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class DevelopmentApplicationSerializer(serializers.ModelSerializer):
    conditions        = DAConditionSerializer(many=True, read_only=True)
    milestones        = DAMilestoneSerializer(many=True, read_only=True)
    stage_name        = serializers.SerializerMethodField()
    is_lapsing_soon   = serializers.BooleanField(read_only=True)
    days_until_lapse  = serializers.IntegerField(read_only=True)
    open_conditions   = serializers.SerializerMethodField()

    class Meta:
        model  = DevelopmentApplication
        fields = [
            "id", "project", "stage", "stage_name",
            "reference_number", "authority", "status",
            "lodgement_date", "approval_date", "lapse_date",
            "commencement_confirmed", "commencement_date",
            "notes", "is_lapsing_soon", "days_until_lapse",
            "open_conditions",
            "conditions", "milestones",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_stage_name(self, obj):
        return obj.stage.name if obj.stage else None

    def get_open_conditions(self, obj):
        return obj.conditions.exclude(status__in=["complete", "waived"]).count()


class DevelopmentApplicationListSerializer(serializers.ModelSerializer):
    stage_name       = serializers.SerializerMethodField()
    is_lapsing_soon  = serializers.BooleanField(read_only=True)
    days_until_lapse = serializers.IntegerField(read_only=True)
    open_conditions  = serializers.SerializerMethodField()
    total_conditions = serializers.SerializerMethodField()

    class Meta:
        model  = DevelopmentApplication
        fields = [
            "id", "project", "stage", "stage_name",
            "reference_number", "authority", "status",
            "lodgement_date", "approval_date", "lapse_date",
            "commencement_confirmed", "commencement_date",
            "is_lapsing_soon", "days_until_lapse",
            "open_conditions", "total_conditions",
            "created_at", "updated_at",
        ]

    def get_stage_name(self, obj):
        return obj.stage.name if obj.stage else None

    def get_open_conditions(self, obj):
        return obj.conditions.exclude(status__in=["complete", "waived"]).count()

    def get_total_conditions(self, obj):
        return obj.conditions.count()
