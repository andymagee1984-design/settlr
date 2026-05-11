"""
apps/contacts/models.py
"""

import uuid
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
    converted_at       = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["last_name", "first_name", "entity_name"]
        indexes  = [models.Index(fields=["organisation", "id"])]

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

    # Commission defaults
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