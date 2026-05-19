"""
LOCATION: property_crm/apps/notifications/notify.py

Full replacement of the existing file.

Changes from previous version:
  - _notify_all: role names updated from "Sales Manager" → "Project Manager"
  - _create: now accepts optional `da` and `project` kwargs
  - _notify_da_recipients: new helper — targets DA submitter + Admin/Project Manager only
  - Four new DA notification functions added at the bottom
"""

import logging
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _create(organisation, recipient, notif_type, title, message, sale=None, da=None, project=None):
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
            da=da,
            project=project,
        )
    except Exception as e:
        logger.error(f"notify._create failed: {e}")


def _notify_all(sale, notif_type, title, message):
    """
    Send a notification to all relevant recipients for a sale event:
      - The sale creator
      - All Admin and Project Manager users in the organisation

    Deduplicates by recipient ID so nobody receives the same
    notification twice even if they appear in both groups.

    Agency-side roles (Agency Manager, Agent External) are intentionally excluded.
    """
    try:
        from apps.users.models import User

        managers = User.objects.filter(
            organisation=sale.organisation,
            is_active=True,
            role__name__in=["Admin", "Project Manager"],
        ).select_related("role")

        seen       = set()
        recipients = []

        if sale.created_by_id:
            seen.add(sale.created_by_id)
            recipients.append(sale.created_by)

        for manager in managers:
            if manager.id not in seen:
                seen.add(manager.id)
                recipients.append(manager)

        for recipient in recipients:
            _create(sale.organisation, recipient, notif_type, title, message, sale=sale)

    except Exception as e:
        logger.error(f"notify._notify_all failed for sale {sale.pk}: {e}")


def _notify_da_recipients(da, notif_type, title, message):
    """
    Send a DA notification to:
      - The DA's created_by user (the submitter)
      - All active Admin and Project Manager users in the organisation

    Agency-side roles never receive DA notifications.
    Deduplicates by recipient ID.
    """
    try:
        from apps.users.models import User

        organisation = da.project.organisation
        project      = da.project

        managers = User.objects.filter(
            organisation=organisation,
            is_active=True,
            role__name__in=["Admin", "Project Manager"],
        ).select_related("role")

        seen       = set()
        recipients = []

        if da.created_by_id:
            seen.add(da.created_by_id)
            recipients.append(da.created_by)

        for manager in managers:
            if manager.id not in seen:
                seen.add(manager.id)
                recipients.append(manager)

        for recipient in recipients:
            _create(organisation, recipient, notif_type, title, message, da=da, project=project)

    except Exception as e:
        logger.error(f"notify._notify_da_recipients failed for DA {da.pk}: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Sale notifications
# ─────────────────────────────────────────────────────────────────────────────

def notify_pending_sale(sale):
    """Called when a sale moves to Pending."""
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
    """Called when a sale moves to Reserved (approved)."""
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
    """Called when a sale is declined."""
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
    """Called when a sale is marked as fallen over."""
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
    """Called 4 hours before on_hold_expiry."""
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


# ─────────────────────────────────────────────────────────────────────────────
# DA notifications — called from process_da_notifications management command
# ─────────────────────────────────────────────────────────────────────────────

def notify_da_lapse_warning(da, days_remaining: int):
    """
    DA is approaching its lapse date.
    Fires at 30 days and again at 14 days (controlled by the cron command).
    """
    try:
        project = da.project
        ref     = da.reference_number or "—"
        title   = f"DA lapsing in {days_remaining} days — {project.name}"
        message = (
            f"Development application {ref} for {project.name} will lapse in "
            f"{days_remaining} days. Commencement of works must be confirmed or "
            f"the DA renewed before the lapse date."
        )
        _notify_da_recipients(da, "da_lapse_warning", title, message)
    except Exception as e:
        logger.error(f"notify_da_lapse_warning failed for DA {da.pk}: {e}")


def notify_da_condition_due_soon(condition):
    """
    A DA condition's due date is within 7 days and still open/in-progress.
    """
    try:
        da      = condition.da
        project = da.project
        ref     = da.reference_number or "—"
        cond_id = condition.condition_number or f"#{condition.id}"
        title   = f"DA condition due soon — {project.name}"
        message = (
            f"Condition {cond_id} on DA {ref} ({project.name}) is due within 7 days. "
            f"Category: {condition.get_category_display()}. "
            f"Description: {condition.description[:120]}"
            f"{'…' if len(condition.description) > 120 else ''}"
        )
        _notify_da_recipients(da, "da_condition_due_soon", title, message)
    except Exception as e:
        logger.error(f"notify_da_condition_due_soon failed for condition {condition.pk}: {e}")


def notify_da_condition_overdue(condition):
    """
    A DA condition's due date has passed and status is still open/in-progress.
    """
    try:
        da      = condition.da
        project = da.project
        ref     = da.reference_number or "—"
        cond_id = condition.condition_number or f"#{condition.id}"
        title   = f"DA condition overdue — {project.name}"
        message = (
            f"Condition {cond_id} on DA {ref} ({project.name}) is overdue. "
            f"Category: {condition.get_category_display()}. "
            f"Description: {condition.description[:120]}"
            f"{'…' if len(condition.description) > 120 else ''}"
        )
        _notify_da_recipients(da, "da_condition_overdue", title, message)
    except Exception as e:
        logger.error(f"notify_da_condition_overdue failed for condition {condition.pk}: {e}")


def notify_da_milestone_overdue(milestone):
    """
    A DA milestone's planned date has passed with no actual date recorded.
    """
    try:
        da      = milestone.da
        project = da.project
        ref     = da.reference_number or "—"
        label   = milestone.display_label or milestone.label or milestone.milestone_type
        planned = milestone.planned_date.strftime("%d %b %Y") if milestone.planned_date else "unknown"
        title   = f"DA milestone overdue — {project.name}"
        message = (
            f"Milestone '{label}' on DA {ref} ({project.name}) was planned for "
            f"{planned} but has not been marked as complete."
        )
        _notify_da_recipients(da, "da_milestone_overdue", title, message)
    except Exception as e:
        logger.error(f"notify_da_milestone_overdue failed for milestone {milestone.pk}: {e}")