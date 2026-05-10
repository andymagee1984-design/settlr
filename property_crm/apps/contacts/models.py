"""
apps/contacts/models.py

Buyer, Agency, Agent, Solicitor, Referrer.
All are tenant-scoped via OrgScopedModel.
"""

import uuid
from django.db import models
from apps.core.models import OrgScopedModel


class Buyer(OrgScopedModel):
    """
    A purchaser. Can be an individual, company, or trust.
    Global across all projects in the organisation.
    """

    class BuyerType(models.TextChoices):
        INDIVIDUAL = "individual", "Individual"
        COMPANY    = "company",    "Company"
        TRUST      = "trust",      "Trust"

    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    buyer_type        = models.CharField(max_length=20, choices=BuyerType.choices)

    # Individual fields
    first_name        = models.CharField(max_length=100, blank=True)
    last_name         = models.CharField(max_length=100, blank=True)
    date_of_birth     = models.DateField(null=True, blank=True)
    occupation        = models.CharField(max_length=150, blank=True)

    # Company / trust fields
    entity_name       = models.CharField(max_length=255, blank=True)
    abn               = models.CharField(max_length=20, blank=True)
    trustee_name      = models.CharField(max_length=255, blank=True, help_text="Trust only")

    # Shared
    email             = models.EmailField()
    phone             = models.CharField(max_length=30)
    address           = models.TextField(blank=True)
    investment_intent = models.BooleanField(default=False)
    marketing_opt_in  = models.BooleanField(default=False)
    id_verified       = models.BooleanField(default=False)

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


class Agency(OrgScopedModel):
    """A real estate agency. Parent object to Agents."""

    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name    = models.CharField(max_length=255)
    address = models.TextField(blank=True)
    phone   = models.CharField(max_length=30, blank=True)
    email   = models.EmailField(blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Agencies"
        indexes = [models.Index(fields=["organisation", "id"])]

    def __str__(self):
        return self.name


class Agent(OrgScopedModel):
    """An individual agent, always linked to a parent Agency."""

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
    """A buyer's legal representative or conveyancer."""

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
    """An introducer. Tracked for relationship purposes — not part of commission."""

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
