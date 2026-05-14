"""
apps/notifications/models.py
"""

import uuid
from django.db import models
from apps.core.models import OrgScopedModel


class SalesAdviceLog(OrgScopedModel):
    class Status(models.TextChoices):
        SENT   = "sent",   "Sent"
        FAILED = "failed", "Failed"

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale       = models.ForeignKey("sales.Sale", on_delete=models.CASCADE, related_name="advice_logs")
    status     = models.CharField(max_length=20, choices=Status.choices, default=Status.SENT)
    recipients = models.TextField(help_text="Comma-separated list of addresses the email was sent to.")
    error      = models.TextField(blank=True)
    sent_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering     = ["-sent_at"]
        verbose_name = "Sales Advice Log"

    def __str__(self):
        return f"Sales Advice — {self.sale} — {self.status} — {self.sent_at:%Y-%m-%d %H:%M}"

    def get_recipient_list(self) -> list[str]:
        return [r.strip() for r in self.recipients.split(",") if r.strip()]


class Notification(OrgScopedModel):
    """In-app notification delivered to a specific user."""

    class NotifType(models.TextChoices):
        SALE_PENDING   = "sale_pending",   "Sale pending approval"
        SALE_APPROVED  = "sale_approved",  "Sale approved"
        SALE_DECLINED  = "sale_declined",  "Sale declined"
        ON_HOLD_EXPIRY = "on_hold_expiry", "On hold expiring soon"
        DUE_TOMORROW   = "due_tomorrow",   "Activity due tomorrow"
        DUE_TODAY      = "due_today",      "Activity due today"
        OVERDUE        = "overdue",        "Activity overdue"

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient  = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notif_type = models.CharField(max_length=30, choices=NotifType.choices)
    title      = models.CharField(max_length=200)
    message    = models.TextField()
    sale       = models.ForeignKey(
        "sales.Sale",
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="notifications",
    )
    is_read    = models.BooleanField(default=False)
    read_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["organisation", "recipient", "is_read"]),
        ]

    def __str__(self):
        return f"{self.notif_type} → {self.recipient} ({'read' if self.is_read else 'unread'})"