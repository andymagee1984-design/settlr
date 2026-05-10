"""
apps/projects/models.py

Project, ProjectMedia, Stage, Lot, LotPriceHistory.

Key design decisions (from 04_django_models.md):
- Lot.status is a derived @property — no stored status field.
- Lot.is_released encodes Draft vs Available (can't be derived from a Sale).
- LotManager.with_status() annotates querysets for filtering by status.
- Stage and Lot are tenant-scoped via parent chain — no direct organisation FK.
"""

import uuid
from django.db import models
from django.db.models import Q, Subquery, OuterRef, Value, Case, When

from apps.core.models import OrgScopedModel, TimeStampedModel


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

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

    # Billing — set automatically on activation / final settlement
    billing_lot_count  = models.PositiveIntegerField(null=True, blank=True, help_text="Locked at activation")
    billing_start_date = models.DateField(null=True, blank=True)
    billing_end_date   = models.DateField(null=True, blank=True)
    billing_status     = models.CharField(max_length=20, choices=BillingStatus.choices, default=BillingStatus.ACTIVE)

    class Meta:
        ordering = ["name"]
        indexes  = [models.Index(fields=["organisation", "id"])]

    def __str__(self):
        return self.name

    def activate(self):
        """
        Called by the platform team when a project goes live.
        Locks billing_lot_count and sets billing_start_date.
        """
        from datetime import date
        if self.status == self.Status.DRAFT:
            self.billing_lot_count  = self.lots_count()
            self.billing_start_date = date.today()
            self.status             = self.Status.ACTIVE
            self.save(update_fields=["status", "billing_lot_count", "billing_start_date"])

    def lots_count(self):
        return Lot.objects.filter(stage__project=self).count()

    def check_billing_complete(self):
        """
        Called after each lot settles. If no unsettled lots remain,
        sets billing_end_date and marks the project completed.
        """
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


# ---------------------------------------------------------------------------
# ProjectMedia
# ---------------------------------------------------------------------------

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
    title       = models.CharField(max_length=255)
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


# ---------------------------------------------------------------------------
# Stage
# ---------------------------------------------------------------------------

class Stage(TimeStampedModel):
    """
    Tenant-scoped via Project -> Organisation chain.
    No direct organisation FK.
    """

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project          = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="stages")
    name             = models.CharField(max_length=100)
    stage_number     = models.PositiveIntegerField()
    expected_release = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["project", "stage_number"]
        unique_together = [("project", "stage_number")]

    def __str__(self):
        return f"{self.project} — {self.name}"


# ---------------------------------------------------------------------------
# Lot status choices (used by both the @property and the annotated queryset)
# ---------------------------------------------------------------------------

class LotStatus(models.TextChoices):
    DRAFT     = "draft",     "Draft"
    AVAILABLE = "available", "Available"
    ON_HOLD   = "on_hold",   "On Hold"
    RESERVED  = "reserved",  "Reserved"
    SETTLED   = "settled",   "Settled"


# ---------------------------------------------------------------------------
# Lot manager
# ---------------------------------------------------------------------------

class LotManager(models.Manager):

    def with_status(self):
        """
        Annotates each Lot row with computed_status for queryset filtering.
        Use for list endpoints that filter by status.
        Never filter on lot.status in a queryset — it is a Python property.

        Two-step annotate pattern:
          1. active_sale_status — subquery for the active sale's status string.
          2. computed_status    — Case/When on active_sale_status + is_released.
        """
        from apps.sales.models import Sale

        # Step 1: subquery returns the status string of the one active sale (if any)
        active_sale_sq = Subquery(
            Sale.objects
            .filter(lot=OuterRef("pk"))
            .exclude(status=Sale.Status.FALLEN_OVER)
            .values("status")[:1]
        )

        qs = self.get_queryset().annotate(active_sale_status=active_sale_sq)

        # Step 2: map (is_released, active_sale_status) -> computed_status
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


# ---------------------------------------------------------------------------
# Lot
# ---------------------------------------------------------------------------

class Lot(TimeStampedModel):
    """
    The core asset. Tenant-scoped via Stage -> Project -> Organisation.
    status is a derived @property — never stored.
    is_released encodes Draft vs Available.
    """

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
    is_released    = models.BooleanField(
        default=False,
        help_text="False=Draft, True=Available (when no active sale)",
    )

    # Specifications
    bedrooms       = models.PositiveSmallIntegerField(null=True, blank=True)
    bathrooms      = models.PositiveSmallIntegerField(null=True, blank=True)
    car_spaces     = models.PositiveSmallIntegerField(null=True, blank=True)
    land_area      = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="m²")
    floor_area     = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="m²")
    aspect         = models.CharField(max_length=50, blank=True)
    level          = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Apartments")
    building       = models.CharField(max_length=100, blank=True, help_text="Apartments / multi-building")
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
        """
        Derive lot status from is_released and the active Sale's status.
        Single-instance access only — use .with_status() for querysets.
        """
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
        """Returns the most recent LotPriceHistory price, or None."""
        record = self.price_history.order_by("-effective_date", "-created_at").first()
        return record.price if record else None


# ---------------------------------------------------------------------------
# LotPriceHistory
# ---------------------------------------------------------------------------

class LotPriceHistory(TimeStampedModel):
    """Every price change on a Lot. Current price = most recent record."""

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
