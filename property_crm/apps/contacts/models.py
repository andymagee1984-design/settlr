"""
apps/contacts/models.py
"""

import uuid
import secrets
from django.db import models
from apps.core.models import OrgScopedModel


class Buyer(OrgScopedModel):
    class BuyerType(models.TextChoices):
        INDIVIDUAL = "individual", "Individual"
        COMPANY    = "company",    "Company"
        TRUST      = "trust",      "Trust"

    class InterestLevel(models.TextChoices):
        HOT  = "hot",  "Hot"
        WARM = "warm", "Warm"
        COLD = "cold", "Cold"

    class Source(models.TextChoices):
        AGENT    = "agent",    "Agent referral"
        WEBSITE  = "website",  "Website enquiry"
        DISPLAY  = "display",  "Display suite"
        REFERRAL = "referral", "Personal referral"
        SOCIAL   = "social",   "Social media"
        OTHER    = "other",    "Other"

    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    buyer_type         = models.CharField(max_length=20, choices=BuyerType.choices)
    first_name         = models.CharField(max_length=100, blank=True)
    last_name          = models.CharField(max_length=100, blank=True)
    date_of_birth      = models.DateField(null=True, blank=True)
    occupation         = models.CharField(max_length=150, blank=True)
    entity_name        = models.CharField(max_length=255, blank=True)
    abn                = models.CharField(max_length=20, blank=True)
    trustee_name       = models.CharField(max_length=255, blank=True)
    email              = models.EmailField()
    phone              = models.CharField(max_length=30)
    address            = models.TextField(blank=True)
    interest_level     = models.CharField(max_length=10, choices=InterestLevel.choices, blank=True, default="")
    budget_min         = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    budget_max         = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    preferred_lot_type = models.CharField(max_length=30, blank=True)
    source             = models.CharField(max_length=20, choices=Source.choices, blank=True, default="")
    notes              = models.TextField(blank=True)
    investment_intent  = models.BooleanField(default=False)
    marketing_opt_in   = models.BooleanField(default=False)
    id_verified        = models.BooleanField(default=False)
    is_return_buyer    = models.BooleanField(
        default=False,
        help_text="True when this buyer has more than one sale linked to their record.",
    )
    converted_at       = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["last_name", "first_name", "entity_name"]
        indexes  = [
            models.Index(fields=["organisation", "id"]),
            models.Index(fields=["organisation", "email"]),
        ]

    def __str__(self):
        if self.buyer_type == self.BuyerType.INDIVIDUAL:
            return f"{self.first_name} {self.last_name}".strip()
        return self.entity_name

    @property
    def display_name(self):
        return str(self)

    @property
    def is_converted(self):
        return self.converted_at is not None


class Agency(OrgScopedModel):
    """
    A real estate agency. Parent object to Agents.
    default_commission_type and default_commission_rate are used to
    auto-populate the Commission record when a sale reaches Exchanged.
    """

    class CommissionType(models.TextChoices):
        PERCENTAGE = "percentage", "Percentage"
        FLAT       = "flat",       "Flat amount"

    id                       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name                     = models.CharField(max_length=255)
    address                  = models.TextField(blank=True)
    phone                    = models.CharField(max_length=30, blank=True)
    email                    = models.EmailField(blank=True)

    default_commission_type  = models.CharField(
        max_length=20, choices=CommissionType.choices,
        blank=True, default="",
        help_text="Default commission type for agents from this agency",
    )
    default_commission_rate  = models.DecimalField(
        max_digits=6, decimal_places=4,
        null=True, blank=True,
        help_text="Percentage (e.g. 2.5000 for 2.5%) or flat amount depending on type",
    )

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Agencies"
        indexes = [models.Index(fields=["organisation", "id"])]

    def __str__(self):
        return self.name


class Agent(OrgScopedModel):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agency     = models.ForeignKey(Agency, on_delete=models.CASCADE, related_name="agents")
    first_name = models.CharField(max_length=100)
    last_name  = models.CharField(max_length=100)
    email      = models.EmailField()
    phone      = models.CharField(max_length=30, blank=True)
    is_active  = models.BooleanField(default=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        indexes = [models.Index(fields=["organisation", "id"])]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def full_name(self):
        return str(self)


class Solicitor(OrgScopedModel):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=100)
    last_name  = models.CharField(max_length=100)
    firm_name  = models.CharField(max_length=255, blank=True)
    email      = models.EmailField(blank=True)
    phone      = models.CharField(max_length=30, blank=True)
    address    = models.TextField(blank=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        indexes = [models.Index(fields=["organisation", "id"])]

    def __str__(self):
        name = f"{self.first_name} {self.last_name}".strip()
        if self.firm_name:
            return f"{name} ({self.firm_name})"
        return name


class Referrer(OrgScopedModel):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name   = models.CharField(max_length=100)
    last_name    = models.CharField(max_length=100)
    company_name = models.CharField(max_length=255, blank=True)
    email        = models.EmailField(blank=True)
    phone        = models.CharField(max_length=30, blank=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        indexes = [models.Index(fields=["organisation", "id"])]

    def __str__(self):
        name = f"{self.first_name} {self.last_name}".strip()
        if self.company_name:
            return f"{name} ({self.company_name})"
        return name


# ─────────────────────────────────────────────────────────────────────────────
# Prospect
# ─────────────────────────────────────────────────────────────────────────────

class Prospect(OrgScopedModel):
    """
    A pre-purchase lead. Entry point for all potential buyers in the system.

    Prospects enter via:
        - Website enquiry form (source=website_form)
        - Portal webhook from Domain/REA (source=portal)
        - Manual entry by sales team (source=walk_in / phone / referral)

    A Prospect converts to a Buyer when a linked Sale is approved by the
    developer. Returning buyer detection runs automatically on creation
    by matching email (case insensitive) + first_name (case insensitive)
    against existing Buyer records in the same organisation.

    Engagement level is derived from activities — never stored.
    """

    class Source(models.TextChoices):
        WEBSITE_FORM = "website_form", "Website enquiry form"
        PORTAL       = "portal",       "Portal (Domain / REA)"
        WALK_IN      = "walk_in",      "Walk-in"
        PHONE        = "phone",        "Phone enquiry"
        REFERRAL     = "referral",     "Referral"
        OTHER        = "other",        "Other"

    class Status(models.TextChoices):
        ACTIVE    = "active",    "Active"
        CONVERTED = "converted", "Converted"
        LOST      = "lost",      "Lost"

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=100)
    last_name  = models.CharField(max_length=100)
    email      = models.EmailField()
    phone      = models.CharField(max_length=30, blank=True)

    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.OTHER,
    )

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="prospects",
    )
    lot = models.ForeignKey(
        "projects.Lot",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="prospects",
    )

    status      = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    lost_reason = models.TextField(blank=True)

    assigned_to = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="assigned_prospects",
    )

    notes = models.TextField(blank=True)

    # Returning buyer detection
    is_returning_buyer = models.BooleanField(
        default=False,
        help_text="Set True when matched to an existing Buyer on creation.",
    )
    buyer = models.ForeignKey(
        "contacts.Buyer",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="prospects",
        help_text="Linked Buyer — set on match (returning) or conversion.",
    )

    converted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["organisation", "status"]),
            models.Index(fields=["organisation", "email"]),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def engagement_level(self):
        """
        Derived from activity count and recency. Never stored.

        Cold — no activities
        Warm — 1-2 activities, or last activity > 14 days ago
        Hot  — 3+ activities with at least one in the last 14 days
        """
        from django.utils import timezone
        from datetime import timedelta

        activities = self.activities.all()
        count = activities.count()

        if count == 0:
            return "cold"

        cutoff = timezone.now() - timedelta(days=14)
        recent = activities.filter(created_at__gte=cutoff).exists()

        if count >= 3 and recent:
            return "hot"
        return "warm"

    @classmethod
    def match_returning_buyer(cls, organisation, email, first_name):
        """
        Returns a matching Buyer record or None.
        Match: email (case insensitive) + first_name (case insensitive).
        Call this before saving a new Prospect to detect returning buyers.
        """
        return Buyer.objects.filter(
            organisation=organisation,
            email__iexact=email.strip(),
            first_name__iexact=first_name.strip(),
        ).first()


# ─────────────────────────────────────────────────────────────────────────────
# EnquiryForm
# ─────────────────────────────────────────────────────────────────────────────

class EnquiryForm(OrgScopedModel):
    """
    Public-facing web enquiry form configuration, one per Project.

    Public submission endpoint (no auth required):
        POST /api/v1/enquiries/{form_token}/

    Portal webhook endpoint (org_token auth):
        POST /api/v1/webhooks/portal/{org_token}/

    The org_token lives on the Organisation model in apps/core/models.py.
    Add it there separately:
        org_token = models.CharField(
            max_length=64, unique=True, default=secrets.token_urlsafe
        )
    """

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project    = models.OneToOneField(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="enquiry_form",
    )
    form_token = models.CharField(
        max_length=64,
        unique=True,
        default=secrets.token_urlsafe,
        help_text="Unique token for the public submission URL.",
    )
    is_active  = models.BooleanField(
        default=True,
        help_text="When False, the endpoint returns 404 and creates no prospects.",
    )
    default_assigned_to = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="+",
        help_text="New prospects auto-assigned to this user.",
    )

    class Meta:
        ordering            = ["-created_at"]
        verbose_name        = "Enquiry form"
        verbose_name_plural = "Enquiry forms"

    def __str__(self):
        return f"Enquiry form — {self.project.name}"

    def regenerate_token(self):
        """Issue a new form token — use if the current token is compromised."""
        self.form_token = secrets.token_urlsafe()
        self.save(update_fields=["form_token"])