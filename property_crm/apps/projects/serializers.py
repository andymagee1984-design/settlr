"""
apps/projects/serializers.py
"""

from rest_framework import serializers

from apps.contacts.models import Solicitor
from apps.projects.models import (
    DAActivityLog,
    DAComment,
    DACondition,
    DADocument,
    DAMilestone,
    DevelopmentApplication,
    ConditionComment,
    Lot,
    LotPriceHistory,
    Project,
    ProjectMedia,
    Stage,
)

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


class ProjectMediaSerializer(serializers.ModelSerializer):
    file_url         = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = ProjectMedia
        fields = ["id", "media_type", "category", "title", "file_url", "sort_order", "uploaded_by_name", "created_at"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip()
        return None


class LotSummarySerializer(serializers.ModelSerializer):
    status        = serializers.SerializerMethodField()
    current_price = serializers.SerializerMethodField()

    class Meta:
        model  = Lot
        fields = ["id", "lot_number", "lot_type", "bedrooms", "bathrooms", "car_spaces", "land_area", "floor_area", "aspect", "level", "building", "status", "current_price"]

    def get_status(self, obj):
        return obj.status

    def get_current_price(self, obj):
        record = LotPriceHistory.objects.filter(lot=obj).order_by("-effective_date", "-created_at").first()
        return record.price if record else None


class LotSerializer(serializers.ModelSerializer):
    status        = serializers.SerializerMethodField()
    current_price = serializers.SerializerMethodField()
    stage_name    = serializers.CharField(source="stage.name", read_only=True)
    project_name  = serializers.CharField(source="stage.project.name", read_only=True)
    project_id    = serializers.UUIDField(source="stage.project.id", read_only=True)

    class Meta:
        model  = Lot
        fields = ["id", "lot_number", "lot_type", "bedrooms", "bathrooms", "car_spaces", "land_area", "floor_area", "aspect", "level", "building", "inclusions", "floor_plan_url", "is_released", "status", "current_price", "stage_name", "project_name", "project_id", "created_at"]

    def get_status(self, obj):
        return getattr(obj, "computed_status", None) or obj.status

    def get_current_price(self, obj):
        record = LotPriceHistory.objects.filter(lot=obj).order_by("-effective_date", "-created_at").first()
        return record.price if record else None


class StageSerializer(serializers.ModelSerializer):
    lots      = LotSummarySerializer(many=True, read_only=True)
    lot_count = serializers.IntegerField(source="lots.count", read_only=True)

    class Meta:
        model  = Stage
        fields = ["id", "name", "stage_number", "expected_release", "lot_count", "lots"]


class SolicitorMinimalSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model  = Solicitor
        fields = ["id", "full_name", "firm_name", "email", "phone"]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


class ProjectListSerializer(serializers.ModelSerializer):
    lot_counts     = serializers.SerializerMethodField()
    stage_count    = serializers.IntegerField(source="stages.count", read_only=True)
    hero_image_url = serializers.SerializerMethodField()

    class Meta:
        model  = Project
        fields = ["id", "name", "address", "status", "tagline", "website_url", "billing_lot_count", "billing_start_date", "billing_end_date", "billing_status", "stage_count", "lot_counts", "hero_image_url", "created_at"]

    def get_lot_counts(self, obj):
        return {
            "total":     getattr(obj, "_count_total",     0),
            "draft":     getattr(obj, "_count_draft",     0),
            "available": getattr(obj, "_count_available", 0),
            "on_hold":   getattr(obj, "_count_on_hold",   0),
            "reserved":  getattr(obj, "_count_reserved",  0),
            "settled":   getattr(obj, "_count_settled",   0),
        }

    def get_hero_image_url(self, obj):
        hero = obj.media.filter(category="hero", media_type="image").first()
        if not hero:
            return None
        request = self.context.get("request")
        if hero.file and request:
            return request.build_absolute_uri(hero.file.url)
        return hero.file.url if hero.file else None


class ProjectDetailSerializer(serializers.ModelSerializer):
    stages     = StageSerializer(many=True, read_only=True)
    media      = serializers.SerializerMethodField()
    solicitor  = SolicitorMinimalSerializer(read_only=True)
    lot_counts = serializers.SerializerMethodField()

    class Meta:
        model  = Project
        fields = ["id", "name", "address", "status", "tagline", "description", "website_url", "solicitor", "billing_lot_count", "billing_start_date", "billing_end_date", "billing_status", "target_gr", "lot_counts", "stages", "media", "created_at"]

    def get_lot_counts(self, obj):
        all_lots = Lot.objects.filter(stage__project=obj)
        counts = {"total": 0, "draft": 0, "available": 0, "on_hold": 0, "reserved": 0, "settled": 0, "total_gr": str(obj.target_gr) if obj.target_gr else None}
        for lot in all_lots:
            counts["total"] += 1
            s = lot.status
            if s in counts:
                counts[s] += 1
        return counts

    def get_media(self, obj):
        all_media  = obj.media.all()
        serialized = ProjectMediaSerializer(all_media, many=True, context=self.context).data
        grouped    = {"hero": [], "gallery": [], "brochure": [], "site_map": [], "floor_plan": [], "other": []}
        for item in serialized:
            cat = item.get("category", "other")
            grouped[cat if cat in grouped else "other"].append(item)
        return grouped


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

class DACommentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = DAComment
        fields = ["id", "da", "body", "created_by", "created_by_name", "created_at"]
        read_only_fields = ["id", "da", "created_by", "created_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return None


class ConditionCommentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = ConditionComment
        fields = ["id", "condition", "body", "created_by", "created_by_name", "created_at"]
        read_only_fields = ["id", "condition", "created_by", "created_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return None


class DAActivityLogSerializer(serializers.ModelSerializer):
    created_by_name    = serializers.SerializerMethodField()
    event_type_display = serializers.CharField(source="get_event_type_display", read_only=True)

    class Meta:
        model  = DAActivityLog
        fields = ["id", "da", "event_type", "event_type_display", "description", "created_by", "created_by_name", "created_at"]
        read_only_fields = ["id", "da", "event_type", "description", "created_by", "created_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return "System"


class DAConditionSerializer(serializers.ModelSerializer):
    responsible_party_name = serializers.SerializerMethodField()
    is_overdue             = serializers.BooleanField(read_only=True)
    comments               = ConditionCommentSerializer(many=True, read_only=True)

    class Meta:
        model  = DACondition
        fields = [
            "id", "da", "condition_number", "category", "description",
            "status", "responsible_party", "responsible_party_name",
            "due_date", "completed_date", "notes",
            "is_overdue", "comments", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_responsible_party_name(self, obj):
        if obj.responsible_party:
            return f"{obj.responsible_party.first_name} {obj.responsible_party.last_name}".strip()
        return None


class DAMilestoneSerializer(serializers.ModelSerializer):
    display_label = serializers.CharField(read_only=True)
    is_overdue    = serializers.BooleanField(read_only=True)

    class Meta:
        model  = DAMilestone
        fields = ["id", "da", "milestone_type", "label", "display_label", "planned_date", "actual_date", "notes", "is_overdue", "created_at"]
        read_only_fields = ["id", "created_at"]


class DADocumentSerializer(serializers.ModelSerializer):
    file_url         = serializers.SerializerMethodField()
    filename         = serializers.SerializerMethodField()
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model  = DADocument
        fields = ["id", "da", "category", "category_display", "title", "file_url", "filename", "uploaded_by", "created_at"]
        read_only_fields = ["id", "da", "uploaded_by", "created_at"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None

    def get_filename(self, obj):
        if obj.file:
            return obj.file.name.split("/")[-1]
        return None


class DevelopmentApplicationSerializer(serializers.ModelSerializer):
    conditions            = DAConditionSerializer(many=True, read_only=True)
    milestones            = DAMilestoneSerializer(many=True, read_only=True)
    documents             = DADocumentSerializer(many=True, read_only=True)
    comments              = DACommentSerializer(many=True, read_only=True)
    activity_log          = DAActivityLogSerializer(many=True, read_only=True)
    stage_name            = serializers.SerializerMethodField()
    owner_name            = serializers.SerializerMethodField()
    is_lapsing_soon       = serializers.BooleanField(read_only=True)
    days_until_lapse      = serializers.IntegerField(read_only=True)
    open_conditions       = serializers.SerializerMethodField()
    total_conditions      = serializers.SerializerMethodField()
    feasibility_totals    = serializers.SerializerMethodField()
    scenario_totals       = serializers.SerializerMethodField()

    class Meta:
        model  = DevelopmentApplication
        fields = [
            "id", "project", "stage", "stage_name",
            "reference_number", "authority", "status",
            "lodgement_date", "approval_date", "lapse_date",
            "commencement_confirmed", "commencement_date",
            "notes", "owner", "owner_name",
            "is_lapsing_soon", "days_until_lapse",
            "open_conditions", "total_conditions",
            "feasibility", "feasibility_committed", "feasibility_committed_at",
            "feasibility_totals", "scenario_totals",
            "conditions", "milestones", "documents",
            "comments", "activity_log",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "feasibility_committed", "feasibility_committed_at"]

    def get_stage_name(self, obj):
        return obj.stage.name if obj.stage else None

    def get_owner_name(self, obj):
        if obj.owner:
            return f"{obj.owner.first_name} {obj.owner.last_name}".strip()
        return None

    def get_open_conditions(self, obj):
        return obj.conditions.exclude(status__in=["complete", "waived"]).count()

    def get_total_conditions(self, obj):
        return obj.conditions.count()

    def get_feasibility_totals(self, obj):
        return obj.get_feasibility_totals()

    def get_scenario_totals(self, obj):
        return obj.get_all_scenario_totals()


DevelopmentApplicationListSerializer = DevelopmentApplicationSerializer