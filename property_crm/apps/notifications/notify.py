"""
apps/notifications/notify.py

Creates in-app Notification records for workflow events.
Called from apps/sales/services.py. Never raises — notification
failures must never block workflow transitions.

Notification recipients:
  - Agent / sale creator  — receives ALL notification types
  - Sales Managers / Admins — also receive all notifications for
    sales within their organisation
  - Deduplication: if the creator is also a manager they receive
    exactly one notification, not two.
"""

import logging
logger = logging.getLogger(__name__)


def _create(organisation, recipient, notif_type, title, message, sale=None):
    """Create a single Notification record. Swallows all exceptions."""
    try:
        from apps.notifications.models import Notification
        Notification.objects.create(
            organisation=organisation,
            recipient=recipient,
            notif_type=notif_type,
            title=title,
            message=message,
            sale=sale,
        )
    except Exception as e:
        logger.error(f"notify._create failed: {e}")


def _notify_all(sale, notif_type, title, message):
    """
    Send a notification to all relevant recipients for a sale event:
      - The sale creator
      - All Sales Manager and Admin users in the organisation

    Deduplicates by recipient ID so nobody receives the same
    notification twice even if they appear in both groups.
    """
    try:
        from apps.users.models import User

        managers = User.objects.filter(
            organisation=sale.organisation,
            is_active=True,
            role__name__in=["Admin", "Sales Manager"],
        ).select_related("role")

        # Build a deduplicated set of recipients
        seen = set()
        recipients = []

        # Creator always first
        if sale.created_by_id:
            seen.add(sale.created_by_id)
            recipients.append(sale.created_by)

        # Managers — skip if already added as creator
        for manager in managers:
            if manager.id not in seen:
                seen.add(manager.id)
                recipients.append(manager)

        for recipient in recipients:
            _create(sale.organisation, recipient, notif_type, title, message, sale)

    except Exception as e:
        logger.error(f"notify._notify_all failed for sale {sale.pk}: {e}")


def notify_pending_sale(sale):
    """
    Called when a sale moves to Pending.
    Notifies the sale creator and all Sales Manager / Admin users (deduplicated).
    """
    try:
        lot     = sale.lot
        project = lot.stage.project
        title   = f"Sale pending approval — Lot {lot.lot_number}, {project.name}"
        message = (
            f"A sale on Lot {lot.lot_number} ({project.name}) has been submitted "
            f"for approval by {sale.created_by.first_name} {sale.created_by.last_name}."
        )
        _notify_all(sale, "sale_pending", title, message)
    except Exception as e:
        logger.error(f"notify_pending_sale failed for sale {sale.pk}: {e}")


def notify_sale_approved(sale):
    """
    Called when a sale moves to Reserved (approved).
    Notifies the sale creator and all managers (deduplicated).
    """
    try:
        lot     = sale.lot
        project = lot.stage.project
        title   = f"Sale approved — Lot {lot.lot_number}, {project.name}"
        message = (
            f"The sale on Lot {lot.lot_number} ({project.name}) has been approved "
            f"by {sale.approved_by.first_name} {sale.approved_by.last_name}. "
            f"The sale is now Reserved."
        )
        _notify_all(sale, "sale_approved", title, message)
    except Exception as e:
        logger.error(f"notify_sale_approved failed for sale {sale.pk}: {e}")


def notify_sale_declined(sale, reason: str):
    """
    Called when a sale is declined.
    Notifies the sale creator and all managers with the decline reason (deduplicated).
    """
    try:
        lot     = sale.lot
        project = lot.stage.project
        title   = f"Sale declined — Lot {lot.lot_number}, {project.name}"
        message = (
            f"The sale on Lot {lot.lot_number} ({project.name}) has been declined. "
            f"Reason: {reason}. Please review and resubmit."
        )
        _notify_all(sale, "sale_declined", title, message)
    except Exception as e:
        logger.error(f"notify_sale_declined failed for sale {sale.pk}: {e}")


def notify_sale_fallen_over(sale):
    """
    Called when a sale is marked as fallen over.
    Notifies the sale creator and all managers (deduplicated).
    """
    try:
        lot     = sale.lot
        project = lot.stage.project
        reason  = getattr(sale, "fallen_over_reason", None) or "No reason given"
        title   = f"Sale fallen over — Lot {lot.lot_number}, {project.name}"
        message = (
            f"The sale on Lot {lot.lot_number} ({project.name}) has fallen over. "
            f"Reason: {reason}. The lot has been returned to market."
        )
        _notify_all(sale, "on_hold_expiry", title, message)
    except Exception as e:
        logger.error(f"notify_sale_fallen_over failed for sale {sale.pk}: {e}")


def notify_on_hold_expiry_warning(sale):
    """
    Called 4 hours before on_hold_expiry.
    Notifies the sale creator and all managers (deduplicated).
    """
    try:
        lot     = sale.lot
        project = lot.stage.project
        expiry  = sale.on_hold_expiry.strftime("%d %b %Y %H:%M") if sale.on_hold_expiry else "soon"
        title   = f"On hold expiring — Lot {lot.lot_number}, {project.name}"
        message = (
            f"The on hold reservation on Lot {lot.lot_number} ({project.name}) "
            f"expires at {expiry}. Submit for approval before it expires or the "
            f"sale will automatically fall over."
        )
        _notify_all(sale, "on_hold_expiry", title, message)
    except Exception as e:
        logger.error(f"notify_on_hold_expiry_warning failed for sale {sale.pk}: {e}")