"""
apps/activities/models.py

Activity — any interaction logged against a Contact or Sale.
Contact linking is polymorphic: contact_type + contact_id.
"""

import uuid
from django.db import models
from apps.core.models import OrgScopedModel


class Activity(OrgScopedModel):

    class ActivityType(models.TextChoices):
        CALL       = "call",       "Call"
        EMAIL      = "email",      "Email"
        MEETING    = "meeting",    "Meeting"
        INSPECTION = "inspection", "Inspection"
        TASK       = "task",       "Task"
        NOTE       = "note",       "Note"

    class ContactType(models.TextChoices):
        BUYER     = "Buyer",     "Buyer"
        AGENT     = "Agent",     "Agent"
        SOLICITOR = "Solicitor", "Solicitor"
        REFERRER  = "Referrer",  "Referrer"

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    activity_type = models.CharField(max_length=20, choices=ActivityType.choices)
    subject       = models.CharField(max_length=255)
    description   = models.TextField(blank=True)
    activity_date = models.DateTimeField()

    # Polymorphic contact link
    contact_type  = models.CharField(max_length=20, choices=ContactType.choices)
    contact_id    = models.UUIDField(help_text="ID of the related Buyer, Agent, Solicitor, or Referrer")

    # Optional sale link
    sale          = models.ForeignKey(
        "sales.Sale",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activities",
    )

    assigned_to   = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activities_assigned",
    )
    created_by    = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="activities_created",
    )
    due_date      = models.DateTimeField(null=True, blank=True, help_text="Tasks only")
    completed_at  = models.DateTimeField(null=True, blank=True, help_text="Null = incomplete")

    class Meta:
        ordering = ["-activity_date"]
        indexes  = [
            models.Index(fields=["organisation", "id"]),
            models.Index(fields=["contact_type", "contact_id"]),
        ]
        verbose_name_plural = "Activities"

    def __str__(self):
        return f"{self.activity_type} — {self.subject}"

    @property
    def is_complete(self):
        return self.completed_at is not None

    def get_contact(self):
        """Resolve the polymorphic contact object."""
        from apps.contacts.models import Buyer, Agent, Solicitor, Referrer
        model_map = {
            "Buyer":     Buyer,
            "Agent":     Agent,
            "Solicitor": Solicitor,
            "Referrer":  Referrer,
        }
        model = model_map.get(self.contact_type)
        if model:
            return model.objects.filter(pk=self.contact_id).first()
        return None
