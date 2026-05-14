"""
apps/core/models.py

Organisation (the tenant) and all abstract base classes.
Every other app imports from here.
"""

import uuid
import secrets
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

    # Portal webhook authentication token — used to identify the tenant
    # on incoming leads from Domain / REA portal webhooks.
    # Endpoint: POST /api/v1/webhooks/portal/{org_token}/
    # Regenerate via Django Admin if compromised.
    org_token               = models.CharField(
        max_length=64,
        unique=True,
        default=secrets.token_urlsafe,
        help_text="Token for portal webhook authentication (Domain / REA lead ingestion).",
    )

    # Sales advice notifications — comma-separated list of email addresses
    # that receive a copy of every sales advice generated for this organisation.
    # e.g. "developer@example.com,accounts@example.com"
    # Leave blank if no additional recipients beyond solicitors.
    notification_emails     = models.TextField(
        blank=True,
        default="",
        help_text="Comma-separated email addresses to CC on all sales advice emails (e.g. developer mailbox).",
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Organisation"
        verbose_name_plural = "Organisations"

    def __str__(self):
        return self.name

    def get_notification_email_list(self) -> list[str]:
        """Returns notification_emails as a clean list, ignoring blanks."""
        if not self.notification_emails:
            return []
        return [e.strip() for e in self.notification_emails.split(",") if e.strip()]