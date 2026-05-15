import os, sys

BASE = os.getcwd()

# ─────────────────────────────────────────────────────────────────────────────
# 1. Serializers — append to apps/projects/serializers.py
# ─────────────────────────────────────────────────────────────────────────────

SERIAL_PATH = os.path.join(BASE, "property_crm", "apps", "projects", "serializers.py")

DA_SERIALIZERS = """

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
"""

with open(SERIAL_PATH, "r", encoding="utf-8") as f:
    serial_content = f.read()

if "DevelopmentApplicationSerializer" in serial_content:
    print("serializers.py: DA serializers already present — skipping.")
else:
    # Make sure rest_framework.serializers is imported
    if "from rest_framework import serializers" not in serial_content and "import serializers" not in serial_content:
        DA_SERIALIZERS = "from rest_framework import serializers\n" + DA_SERIALIZERS
    with open(SERIAL_PATH, "a", encoding="utf-8") as f:
        f.write(DA_SERIALIZERS)
    print("serializers.py: DA serializers appended.")

# ─────────────────────────────────────────────────────────────────────────────
# 2. Views — append to apps/projects/views.py
# ─────────────────────────────────────────────────────────────────────────────

VIEWS_PATH = os.path.join(BASE, "property_crm", "apps", "projects", "views.py")

DA_VIEWS = """

# =============================================================================
# DA & Planning ViewSets
# =============================================================================

from apps.projects.models import DevelopmentApplication, DACondition, DAMilestone
from apps.projects.serializers import (
    DevelopmentApplicationSerializer,
    DevelopmentApplicationListSerializer,
    DAConditionSerializer,
    DAMilestoneSerializer,
)


class DevelopmentApplicationViewSet(viewsets.ModelViewSet):
    \"\"\"
    CRUD for Development Applications.
    Scoped to the request user's organisation.
    Requires da.manage permission for write operations.
    \"\"\"

    def get_queryset(self):
        org = self.request.user.organisation
        qs  = DevelopmentApplication.objects.filter(
            project__organisation=org
        ).select_related("project", "stage").prefetch_related("conditions", "milestones")

        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return DevelopmentApplicationListSerializer
        return DevelopmentApplicationSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [HasPermission("da.manage")]
        return [HasPermission("report.view")]

    def perform_create(self, serializer):
        serializer.save()


class DAConditionViewSet(viewsets.ModelViewSet):
    \"\"\"
    CRUD for DA Conditions.
    Requires da.manage permission for write operations.
    \"\"\"

    def get_queryset(self):
        org = self.request.user.organisation
        qs  = DACondition.objects.filter(
            da__project__organisation=org
        ).select_related("da", "responsible_party")

        da_id = self.request.query_params.get("da")
        if da_id:
            qs = qs.filter(da_id=da_id)

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs

    serializer_class = DAConditionSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [HasPermission("da.manage")]
        return [HasPermission("report.view")]


class DAMilestoneViewSet(viewsets.ModelViewSet):
    \"\"\"
    CRUD for DA Milestones.
    Requires da.manage permission for write operations.
    \"\"\"

    def get_queryset(self):
        org = self.request.user.organisation
        qs  = DAMilestone.objects.filter(
            da__project__organisation=org
        ).select_related("da")

        da_id = self.request.query_params.get("da")
        if da_id:
            qs = qs.filter(da_id=da_id)

        return qs

    serializer_class = DAMilestoneSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [HasPermission("da.manage")]
        return [HasPermission("report.view")]
"""

with open(VIEWS_PATH, "r", encoding="utf-8") as f:
    views_content = f.read()

if "DevelopmentApplicationViewSet" in views_content:
    print("views.py: DA views already present — skipping.")
else:
    with open(VIEWS_PATH, "a", encoding="utf-8") as f:
        f.write(DA_VIEWS)
    print("views.py: DA views appended.")

# ─────────────────────────────────────────────────────────────────────────────
# 3. URLs — register DA viewsets in apps/projects/urls.py
# ─────────────────────────────────────────────────────────────────────────────

URLS_PATH = os.path.join(BASE, "property_crm", "apps", "projects", "urls.py")

with open(URLS_PATH, "r", encoding="utf-8") as f:
    urls_content = f.read()

if "development-applications" in urls_content:
    print("urls.py: DA routes already registered — skipping.")
else:
    # Add imports
    urls_content = urls_content.replace(
        "from . import views",
        "from . import views\nfrom .views import DevelopmentApplicationViewSet, DAConditionViewSet, DAMilestoneViewSet",
    )
    # Register viewsets before urlpatterns line
    urls_content = urls_content.replace(
        'router.register("lots",     views.LotViewSet,     basename="lot")',
        'router.register("lots",                  views.LotViewSet,                  basename="lot")\nrouter.register("development-applications", DevelopmentApplicationViewSet, basename="da")\nrouter.register("da-conditions",            DAConditionViewSet,            basename="da-condition")\nrouter.register("da-milestones",            DAMilestoneViewSet,            basename="da-milestone")',
    )
    with open(URLS_PATH, "w", encoding="utf-8") as f:
        f.write(urls_content)
    print("urls.py: DA routes registered.")

print("\nAll done. Restart your Django server to activate the new endpoints.")
print("\nNew endpoints:")
print("  GET/POST   /api/v1/development-applications/")
print("  GET/POST   /api/v1/development-applications/?project={id}")
print("  GET/PATCH  /api/v1/development-applications/{id}/")
print("  GET/POST   /api/v1/da-conditions/?da={id}")
print("  GET/PATCH  /api/v1/da-conditions/{id}/")
print("  GET/POST   /api/v1/da-milestones/?da={id}")
print("  GET/PATCH  /api/v1/da-milestones/{id}/")
