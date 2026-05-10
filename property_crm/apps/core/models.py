"""
apps/core/models.py

Organisation (the tenant) and all abstract base classes.
Every other app imports from here.
"""

import uuid
from django.db import models


# ---------------------------------------------------------------------------
# Manager
# ---------------------------------------------------------------------------

class OrgScopedManager(models.Manager):
    """
    Custom manager for tenant-scoped models.
    Always use .for_org(org) in views — never .all() directly.
    """

    def for_org(self, organisation):
        return self.get_queryset().filter(organisation=organisation)


# ---------------------------------------------------------------------------
# Abstract base classes
# ---------------------------------------------------------------------------

class TimeStampedModel(models.Model):
    """
    Adds created_at and updated_at to every model that inherits it.
    Used for models that are NOT directly tenant-scoped (Stage, LotPriceHistory).
    """

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class OrgScopedModel(TimeStampedModel):
    """
    Extends TimeStampedModel with a direct organisation FK.
    Used for every model that belongs to a tenant.

    Note: Stage and Lot are scoped via their parent chain and do NOT
    inherit from this class — they don't carry a direct organisation FK.
    """

    organisation = models.ForeignKey(
        "core.Organisation",
        on_delete=models.CASCADE,
        related_name="+",
    )

    objects = OrgScopedManager()

    class Meta:
        abstract = True
        indexes = [
            # Composite index for fast tenant-scoped lookups on every scoped table.
            # Django can't define this generically on abstract models — each concrete
            # model adds its own (organisation_id, id) index in its own Meta.
        ]


# ---------------------------------------------------------------------------
# Organisation
# ---------------------------------------------------------------------------

class Organisation(TimeStampedModel):
    """
    The top-level tenant. One per customer business.
    Platform team creates these via Django Admin.
    """

    class BillingStatus(models.TextChoices):
        ACTIVE    = "active",    "Active"
        SUSPENDED = "suspended", "Suspended"
        CANCELLED = "cancelled", "Cancelled"

    id                      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name                    = models.CharField(max_length=255)
    slug                    = models.SlugField(max_length=100, unique=True)
    default_state           = models.CharField(max_length=50, help_text="Default state for cooling off legislation")
    cooling_off_days        = models.PositiveIntegerField(default=5)
    holding_deposit_default = models.DecimalField(max_digits=10, decimal_places=2, default=1000)
    billing_status          = models.CharField(max_length=20, choices=BillingStatus.choices, default=BillingStatus.ACTIVE)

    class Meta:
        ordering = ["name"]
        verbose_name = "Organisation"
        verbose_name_plural = "Organisations"

    def __str__(self):
        return self.name
