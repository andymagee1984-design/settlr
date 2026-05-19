"""
apps/projects/models.py
"""

import uuid
from django.db import models
from django.db.models import Q, Subquery, OuterRef, Value, Case, When

from apps.core.models import OrgScopedModel, TimeStampedModel


class Project(OrgScopedModel):

    class Status(models.TextChoices):
        DRAFT     = "draft",     "Draft"
        ACTIVE    = "active",    "Active"
        COMPLETED = "completed", "Completed"

    class BillingStatus(models.TextChoices):
        ACTIVE    = "active",    "Active"
        COMPLETED = "completed", "Completed"

    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name               = models.CharField(max_length=255)
    address            = models.CharField(max_length=500)
    status             = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    tagline            = models.CharField(max_length=255, blank=True)
    description        = models.TextField(blank=True)
    website_url        = models.URLField(blank=True)
    solicitor          = models.ForeignKey(
        "contacts.Solicitor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects_as_vendor_solicitor",
        help_text="The developer's legal representative for this project",
    )

    # Billing
    billing_lot_count  = models.PositiveIntegerField(null=True, blank=True, help_text="Locked at activation")
    billing_start_date = models.DateField(null=True, blank=True)
    billing_end_date   = models.DateField(null=True, blank=True)
    billing_status     = models.CharField(max_length=20, choices=BillingStatus.choices, default=BillingStatus.ACTIVE)
    amenities          = models.JSONField(default=list, blank=True)

    # Feasibility — committed from DA module
    target_gr          = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        help_text="Target gross revenue committed from DA feasibility",
    )

    class Meta:
        ordering = ["name"]
        indexes  = [models.Index(fields=["organisation", "id"])]

    def __str__(self):
        return self.name

    def activate(self):
        from datetime import date
        if self.status == self.Status.DRAFT:
            self.billing_lot_count  = self.lots_count()
            self.billing_start_date = date.today()
            self.status             = self.Status.ACTIVE
            self.save(update_fields=["status", "billing_lot_count", "billing_start_date"])

    def lots_count(self):
        return Lot.objects.filter(stage__project=self).count()

    def check_billing_complete(self):
        from datetime import date
        from apps.sales.models import Sale
        unsettled = (
            Lot.objects
            .filter(stage__project=self)
            .exclude(sales__status=Sale.Status.SETTLED)
            .exists()
        )
        if not unsettled:
            self.billing_end_date = date.today()
            self.billing_status   = self.BillingStatus.COMPLETED
            self.status           = self.Status.COMPLETED
            self.save(update_fields=["billing_end_date", "billing_status", "status"])


class ProjectMedia(TimeStampedModel):

    class MediaType(models.TextChoices):
        IMAGE    = "image",    "Image"
        DOCUMENT = "document", "Document"

    class Category(models.TextChoices):
        HERO       = "hero",       "Hero"
        GALLERY    = "gallery",    "Gallery"
        BROCHURE   = "brochure",   "Brochure"
        SITE_MAP   = "site_map",   "Site Map"
        FLOOR_PLAN = "floor_plan", "Floor Plan"
        OTHER      = "other",      "Other"

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project     = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="media")
    media_type  = models.CharField(max_length=20, choices=MediaType.choices)
    category    = models.CharField(max_length=20, choices=Category.choices)
    title       = models.CharField(max_length=255, blank=True)
    file        = models.FileField(upload_to="project_media/")
    sort_order  = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="+",
    )

    class Meta:
        ordering = ["category", "sort_order", "created_at"]

    def __str__(self):
        return f"{self.project} — {self.title}"


class Stage(TimeStampedModel):
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project          = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="stages")
    name             = models.CharField(max_length=100)
    stage_number     = models.PositiveIntegerField()
    expected_release = models.DateField(null=True, blank=True)

    class Meta:
        ordering        = ["project", "stage_number"]
        unique_together = [("project", "stage_number")]

    def __str__(self):
        return f"{self.project} — {self.name}"


class LotStatus(models.TextChoices):
    DRAFT     = "draft",     "Draft"
    AVAILABLE = "available", "Available"
    ON_HOLD   = "on_hold",   "On Hold"
    RESERVED  = "reserved",  "Reserved"
    SETTLED   = "settled",   "Settled"


class LotManager(models.Manager):

    def with_status(self):
        from apps.sales.models import Sale

        active_sale_sq = Subquery(
            Sale.objects
            .filter(lot=OuterRef("pk"))
            .exclude(status=Sale.Status.FALLEN_OVER)
            .values("status")[:1]
        )

        qs = self.get_queryset().annotate(active_sale_status=active_sale_sq)

        qs = qs.annotate(
            computed_status=Case(
                When(is_released=False, then=Value(LotStatus.DRAFT)),
                When(
                    is_released=True,
                    active_sale_status__in=[
                        Sale.Status.ON_HOLD,
                        Sale.Status.PENDING,
                        Sale.Status.DECLINED,
                    ],
                    then=Value(LotStatus.ON_HOLD),
                ),
                When(
                    is_released=True,
                    active_sale_status__in=[
                        Sale.Status.RESERVED,
                        Sale.Status.CONTRACT_ISSUED,
                        Sale.Status.EXCHANGED,
                    ],
                    then=Value(LotStatus.RESERVED),
                ),
                When(
                    is_released=True,
                    active_sale_status=Sale.Status.SETTLED,
                    then=Value(LotStatus.SETTLED),
                ),
                default=Value(LotStatus.AVAILABLE),
                output_field=models.CharField(),
            )
        )
        return qs


class Lot(TimeStampedModel):

    class LotType(models.TextChoices):
        LAND           = "land",           "Land"
        HOUSE_AND_LAND = "house_and_land", "House & Land"
        APARTMENT      = "apartment",      "Apartment"
        TOWNHOUSE      = "townhouse",      "Townhouse"
        COMMERCIAL     = "commercial",     "Commercial"

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stage          = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name="lots")
    lot_number     = models.CharField(max_length=50)
    lot_type       = models.CharField(max_length=30, choices=LotType.choices)
    is_released    = models.BooleanField(default=False)

    bedrooms       = models.PositiveSmallIntegerField(null=True, blank=True)
    bathrooms      = models.PositiveSmallIntegerField(null=True, blank=True)
    car_spaces     = models.PositiveSmallIntegerField(null=True, blank=True)
    land_area      = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="m²")
    floor_area     = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="m²")
    aspect         = models.CharField(max_length=50, blank=True)
    level          = models.PositiveSmallIntegerField(null=True, blank=True)
    building       = models.CharField(max_length=100, blank=True)
    inclusions     = models.TextField(blank=True)
    floor_plan_url = models.URLField(blank=True)

    objects = LotManager()

    class Meta:
        ordering        = ["stage", "lot_number"]
        unique_together = [("stage", "lot_number")]

    def __str__(self):
        return f"{self.stage.project} — Lot {self.lot_number}"

    @property
    def status(self) -> str:
        if not self.is_released:
            return LotStatus.DRAFT

        from apps.sales.models import Sale
        active_sale = (
            self.sales
            .exclude(status=Sale.Status.FALLEN_OVER)
            .only("status")
            .first()
        )

        if active_sale is None:
            return LotStatus.AVAILABLE

        s = active_sale.status
        if s in (Sale.Status.ON_HOLD, Sale.Status.PENDING, Sale.Status.DECLINED):
            return LotStatus.ON_HOLD
        if s in (Sale.Status.RESERVED, Sale.Status.CONTRACT_ISSUED, Sale.Status.EXCHANGED):
            return LotStatus.RESERVED
        if s == Sale.Status.SETTLED:
            return LotStatus.SETTLED

        return LotStatus.AVAILABLE

    @property
    def current_price(self):
        record = self.price_history.order_by("-effective_date", "-created_at").first()
        return record.price if record else None


class LotPriceHistory(TimeStampedModel):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lot            = models.ForeignKey(Lot, on_delete=models.CASCADE, related_name="price_history")
    price          = models.DecimalField(max_digits=12, decimal_places=2)
    effective_date = models.DateField()
    changed_by     = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="+",
    )
    reason         = models.TextField(blank=True)

    class Meta:
        ordering = ["-effective_date", "-created_at"]

    def __str__(self):
        return f"{self.lot} — ${self.price} from {self.effective_date}"


class ProjectAgency(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project     = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="project_agencies")
    agency      = models.ForeignKey("contacts.Agency", on_delete=models.CASCADE, related_name="project_agencies")
    assigned_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, related_name="+")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["project", "agency"], name="unique_agency_per_project")]
        ordering     = ["assigned_at"]
        verbose_name = "Project agency"
        verbose_name_plural = "Project agencies"

    def __str__(self):
        return f"{self.agency.name} → {self.project.name}"


class LotAgency(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lot         = models.OneToOneField("projects.Lot", on_delete=models.CASCADE, related_name="lot_agency")
    agency      = models.ForeignKey("contacts.Agency", on_delete=models.CASCADE, related_name="exclusive_lots")
    assigned_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, related_name="+")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering     = ["assigned_at"]
        verbose_name = "Lot agency (exclusive)"
        verbose_name_plural = "Lot agencies (exclusive)"

    def __str__(self):
        return f"{self.lot} exclusively assigned to {self.agency.name}"


# =============================================================================
# DA & Planning
# =============================================================================

class DevelopmentApplication(models.Model):
    class Status(models.TextChoices):
        PRE_LODGEMENT     = "pre_lodgement",     "Pre-lodgement"
        LODGED            = "lodged",            "Lodged"
        UNDER_ASSESSMENT  = "under_assessment",  "Under Assessment"
        APPROVED          = "approved",          "Approved"
        CONDITIONS_ISSUED = "conditions_issued", "Conditions Issued"
        OPERATIONAL_WORKS = "operational_works", "Operational Works"

    id                      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project                 = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="development_applications")
    stage                   = models.ForeignKey("projects.Stage", on_delete=models.SET_NULL, null=True, blank=True, related_name="development_applications")
    reference_number        = models.CharField(max_length=100, blank=True)
    authority               = models.CharField(max_length=255, blank=True)
    status                  = models.CharField(max_length=30, choices=Status.choices, default=Status.PRE_LODGEMENT)
    lodgement_date          = models.DateField(null=True, blank=True)
    approval_date           = models.DateField(null=True, blank=True)
    lapse_date              = models.DateField(null=True, blank=True)
    commencement_confirmed  = models.BooleanField(default=False)
    commencement_date       = models.DateField(null=True, blank=True)
    notes                   = models.TextField(blank=True)
    created_at              = models.DateTimeField(auto_now_add=True)
    updated_at              = models.DateTimeField(auto_now=True)
    created_by              = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="development_applications")
    owner                   = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="owned_das")
    last_notified_at        = models.DateTimeField(null=True, blank=True)

    # Feasibility
    feasibility             = models.JSONField(
        default=dict, blank=True,
        help_text="Feasibility model: {lines: [{lot_type, planned_count, avg_size_sqm, rate_per_sqm}], notes: str}",
    )
    feasibility_committed   = models.BooleanField(default=False)
    feasibility_committed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering     = ["-created_at"]
        verbose_name = "Development Application"
        verbose_name_plural = "Development Applications"

    def __str__(self):
        ref   = self.reference_number or "No reference"
        stage = f" - {self.stage.name}" if self.stage else ""
        return f"{self.project.name}{stage} - {ref}"

    @property
    def is_lapsing_soon(self):
        if not self.lapse_date or self.commencement_confirmed:
            return False
        from django.utils import timezone
        from datetime import timedelta
        return self.lapse_date <= (timezone.now().date() + timedelta(days=90))

    @property
    def days_until_lapse(self):
        if not self.lapse_date:
            return None
        from django.utils import timezone
        return (self.lapse_date - timezone.now().date()).days

    def get_feasibility_totals(self):
        """Returns computed totals from the active scenario."""
        scenarios = (self.feasibility or {}).get("scenarios", [])
        # Support legacy flat format too
        if not scenarios:
            lines = (self.feasibility or {}).get("lines", [])
        else:
            active = next((s for s in scenarios if s.get("is_active")), scenarios[0] if scenarios else None)
            lines = active.get("lines", []) if active else []
        total_lots = 0
        total_gr   = 0
        for line in lines:
            count   = int(line.get("planned_count") or 0)
            size    = float(line.get("avg_size_sqm") or 0)
            rate    = float(line.get("rate_per_sqm") or 0)
            total_lots += count
            total_gr   += count * size * rate
        return {"total_lots": total_lots, "total_gr": round(total_gr, 2)}

    def get_all_scenario_totals(self):
        """Returns totals for every scenario — used by the comparison charts."""
        scenarios = (self.feasibility or {}).get("scenarios", [])
        result = []
        for s in scenarios:
            lines = s.get("lines", [])
            total_lots = 0
            total_gr   = 0
            lot_type_breakdown = {}
            for line in lines:
                count = int(line.get("planned_count") or 0)
                size  = float(line.get("avg_size_sqm") or 0)
                rate  = float(line.get("rate_per_sqm") or 0)
                gr    = count * size * rate
                lt    = line.get("lot_type", "other")
                total_lots += count
                total_gr   += gr
                if lt not in lot_type_breakdown:
                    lot_type_breakdown[lt] = {"count": 0, "gr": 0, "rate": rate}
                lot_type_breakdown[lt]["count"] += count
                lot_type_breakdown[lt]["gr"]    += gr
                lot_type_breakdown[lt]["rate"]   = rate
            result.append({
                "id":        s.get("id"),
                "name":      s.get("name", "Unnamed"),
                "is_active": s.get("is_active", False),
                "total_lots": total_lots,
                "total_gr":   round(total_gr, 2),
                "breakdown":  lot_type_breakdown,
            })
        return result


class DACondition(models.Model):
    class Category(models.TextChoices):
        PRE_CONSTRUCTION  = "pre_construction",  "Pre-construction"
        CONSTRUCTION      = "construction",      "Construction"
        POST_CONSTRUCTION = "post_construction", "Post-construction"
        ONGOING           = "ongoing",           "Ongoing"

    class Status(models.TextChoices):
        OPEN        = "open",        "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETE    = "complete",    "Complete"
        WAIVED      = "waived",      "Waived"

    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    da                = models.ForeignKey(DevelopmentApplication, on_delete=models.CASCADE, related_name="conditions")
    condition_number  = models.CharField(max_length=20, blank=True)
    category          = models.CharField(max_length=30, choices=Category.choices, default=Category.PRE_CONSTRUCTION)
    description       = models.TextField()
    status            = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    responsible_party = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="da_conditions")
    due_date          = models.DateField(null=True, blank=True)
    completed_date    = models.DateField(null=True, blank=True)
    notes             = models.TextField(blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)
    last_notified_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering     = ["condition_number", "created_at"]
        verbose_name = "DA Condition"
        verbose_name_plural = "DA Conditions"

    def __str__(self):
        return f"{self.da} - {self.condition_number or 'Condition'}"

    @property
    def is_overdue(self):
        if not self.due_date or self.status in ("complete", "waived"):
            return False
        from django.utils import timezone
        return self.due_date < timezone.now().date()


class DAMilestone(models.Model):
    class MilestoneType(models.TextChoices):
        COMMENCEMENT          = "commencement",          "Commencement of Works"
        PRACTICAL_COMPLETION  = "practical_completion",  "Practical Completion"
        OCCUPATION_CERT       = "occupation_cert",       "Occupation Certificate"
        DEFECTS_LIABILITY_END = "defects_liability_end", "Defects Liability End"
        CUSTOM                = "custom",                "Custom"

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    da               = models.ForeignKey(DevelopmentApplication, on_delete=models.CASCADE, related_name="milestones")
    milestone_type   = models.CharField(max_length=30, choices=MilestoneType.choices)
    label            = models.CharField(max_length=100, blank=True)
    planned_date     = models.DateField(null=True, blank=True)
    actual_date      = models.DateField(null=True, blank=True)
    notes            = models.TextField(blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    last_notified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering     = ["planned_date", "milestone_type"]
        verbose_name = "DA Milestone"
        verbose_name_plural = "DA Milestones"

    def __str__(self):
        label = self.label or self.get_milestone_type_display()
        return f"{self.da} - {label}"

    @property
    def display_label(self):
        if self.milestone_type == "custom" and self.label:
            return self.label
        return self.get_milestone_type_display()

    @property
    def is_overdue(self):
        if self.actual_date or not self.planned_date:
            return False
        from django.utils import timezone
        return self.planned_date < timezone.now().date()


class DADocument(models.Model):
    class Category(models.TextChoices):
        DECISION_NOTICE    = "decision_notice",    "Decision Notice"
        APPROVED_PLANS     = "approved_plans",     "Approved Plans"
        CONDITION_SCHEDULE = "condition_schedule", "Condition Schedule"
        REFERRAL_RESPONSE  = "referral_response",  "Referral Response"
        CORRESPONDENCE     = "correspondence",     "Correspondence"
        OTHER              = "other",              "Other"

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    da          = models.ForeignKey(DevelopmentApplication, on_delete=models.CASCADE, related_name="documents")
    category    = models.CharField(max_length=30, choices=Category.choices, default=Category.OTHER)
    title       = models.CharField(max_length=255, blank=True)
    file        = models.FileField(upload_to="da_documents/")
    uploaded_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, related_name="+")
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering     = ["category", "created_at"]
        verbose_name = "DA Document"
        verbose_name_plural = "DA Documents"

    def __str__(self):
        return f"{self.da} — {self.title or self.get_category_display()}"

    @property
    def file_url(self):
        return self.file.url if self.file else None

    @property
    def filename(self):
        return self.file.name.split("/")[-1] if self.file else None


class DAComment(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    da         = models.ForeignKey(DevelopmentApplication, on_delete=models.CASCADE, related_name="comments")
    body       = models.TextField()
    created_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering     = ["created_at"]
        verbose_name = "DA Comment"
        verbose_name_plural = "DA Comments"

    def __str__(self):
        return f"{self.da} — comment by {self.created_by}"


class ConditionComment(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    condition  = models.ForeignKey(DACondition, on_delete=models.CASCADE, related_name="comments")
    body       = models.TextField()
    created_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering     = ["created_at"]
        verbose_name = "Condition Comment"
        verbose_name_plural = "Condition Comments"

    def __str__(self):
        return f"{self.condition} — comment by {self.created_by}"


class DAActivityLog(models.Model):
    class EventType(models.TextChoices):
        STATUS_CHANGED           = "status_changed",           "Status Changed"
        CONDITION_STATUS_CHANGED = "condition_status_changed", "Condition Status Changed"
        CONDITION_ADDED          = "condition_added",          "Condition Added"
        MILESTONE_ADDED          = "milestone_added",          "Milestone Added"
        MILESTONE_UPDATED        = "milestone_updated",        "Milestone Updated"
        DOCUMENT_UPLOADED        = "document_uploaded",        "Document Uploaded"
        DOCUMENT_DELETED         = "document_deleted",         "Document Deleted"
        OWNER_ASSIGNED           = "owner_assigned",           "Owner Assigned"
        COMMENT_ADDED            = "comment_added",            "Comment Added"
        FEASIBILITY_UPDATED      = "feasibility_updated",      "Feasibility Updated"
        FEASIBILITY_COMMITTED    = "feasibility_committed",    "Feasibility Committed"

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    da          = models.ForeignKey(DevelopmentApplication, on_delete=models.CASCADE, related_name="activity_log")
    event_type  = models.CharField(max_length=50, choices=EventType.choices)
    description = models.TextField()
    created_by  = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, related_name="+")
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering     = ["created_at"]
        verbose_name = "DA Activity Log"
        verbose_name_plural = "DA Activity Logs"

    def __str__(self):
        return f"{self.da} — {self.get_event_type_display()} at {self.created_at}"