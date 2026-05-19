"""
LOCATION: property_crm/apps/projects/management/commands/process_da_notifications.py

New file — sits alongside process_on_hold_expiry.py.
Confirm __init__.py exists in both management/ and management/commands/ directories
(they should already exist since process_on_hold_expiry.py works).

Register in Railway cron — run daily at 08:00:
    python manage.py process_da_notifications

Notification triggers
─────────────────────
DA level:
  - Lapse warning at 30 days remaining   (notif_type: da_lapse_warning)
  - Lapse warning at 14 days remaining   (notif_type: da_lapse_warning)

DACondition level (open or in_progress only):
  - Due within 7 days                    (notif_type: da_condition_due_soon)
  - Past due date                        (notif_type: da_condition_overdue)

DAMilestone level (no actual_date set):
  - Past planned_date                    (notif_type: da_milestone_overdue)

Deduplication
─────────────
Each model has a last_notified_at field. A notification only fires if:
  - last_notified_at is null (never notified), OR
  - last_notified_at is more than 22 hours ago

22 hours gives a daily cadence with clock drift tolerance. A long-running
overdue condition will re-alert each day until resolved or waived.
"""

import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)

NOTIFY_COOLDOWN_HOURS  = 22
LAPSE_WARNING_DAYS     = [30, 14]
CONDITION_DUE_SOON_DAYS = 7


def _not_recently_notified(cooldown):
    """Q filter: never notified OR last notified before cooldown threshold."""
    return Q(last_notified_at__isnull=True) | Q(last_notified_at__lt=cooldown)


class Command(BaseCommand):
    help = "Send DA due-date notifications (lapse warnings, overdue conditions, overdue milestones)"

    def handle(self, *args, **options):
        now      = timezone.now()
        today    = now.date()
        cooldown = now - timedelta(hours=NOTIFY_COOLDOWN_HOURS)

        self.stdout.write(f"[process_da_notifications] Starting at {now.isoformat()}")

        lapse_count    = self._process_lapse_warnings(today, cooldown)
        due_soon_count = self._process_condition_due_soon(today, cooldown)
        cond_od_count  = self._process_condition_overdue(today, cooldown)
        mile_od_count  = self._process_milestone_overdue(today, cooldown)

        self.stdout.write(
            f"[process_da_notifications] Done — "
            f"lapse warnings: {lapse_count}, "
            f"conditions due soon: {due_soon_count}, "
            f"conditions overdue: {cond_od_count}, "
            f"milestones overdue: {mile_od_count}"
        )

    def _process_lapse_warnings(self, today, cooldown):
        from apps.projects.models import DevelopmentApplication
        from apps.notifications.notify import notify_da_lapse_warning

        count = 0
        for threshold_days in LAPSE_WARNING_DAYS:
            target_date = today + timedelta(days=threshold_days)

            candidates = (
                DevelopmentApplication.objects
                .filter(
                    lapse_date=target_date,
                    commencement_confirmed=False,
                )
                .filter(_not_recently_notified(cooldown))
                .select_related("project", "project__organisation", "created_by")
            )

            for da in candidates:
                try:
                    notify_da_lapse_warning(da, days_remaining=threshold_days)
                    da.last_notified_at = timezone.now()
                    da.save(update_fields=["last_notified_at"])
                    count += 1
                    self.stdout.write(
                        f"  ✓ Lapse warning ({threshold_days}d) — "
                        f"{da.reference_number or da.pk} ({da.project.name})"
                    )
                except Exception as e:
                    logger.error(f"Lapse warning failed for DA {da.pk}: {e}")

        return count

    def _process_condition_due_soon(self, today, cooldown):
        from apps.projects.models import DACondition
        from apps.notifications.notify import notify_da_condition_due_soon

        count          = 0
        threshold_date = today + timedelta(days=CONDITION_DUE_SOON_DAYS)

        candidates = (
            DACondition.objects
            .filter(
                due_date__gte=today,
                due_date__lte=threshold_date,
                status__in=["open", "in_progress"],
            )
            .filter(_not_recently_notified(cooldown))
            .select_related("da", "da__project", "da__project__organisation", "da__created_by")
        )

        for condition in candidates:
            try:
                notify_da_condition_due_soon(condition)
                condition.last_notified_at = timezone.now()
                condition.save(update_fields=["last_notified_at"])
                count += 1
                self.stdout.write(
                    f"  ✓ Condition due soon — "
                    f"{condition.condition_number or condition.pk} "
                    f"({condition.da.project.name})"
                )
            except Exception as e:
                logger.error(f"Condition due-soon failed for condition {condition.pk}: {e}")

        return count

    def _process_condition_overdue(self, today, cooldown):
        from apps.projects.models import DACondition
        from apps.notifications.notify import notify_da_condition_overdue

        count = 0

        candidates = (
            DACondition.objects
            .filter(
                due_date__lt=today,
                status__in=["open", "in_progress"],
            )
            .filter(_not_recently_notified(cooldown))
            .select_related("da", "da__project", "da__project__organisation", "da__created_by")
        )

        for condition in candidates:
            try:
                notify_da_condition_overdue(condition)
                condition.last_notified_at = timezone.now()
                condition.save(update_fields=["last_notified_at"])
                count += 1
                self.stdout.write(
                    f"  ✓ Condition overdue — "
                    f"{condition.condition_number or condition.pk} "
                    f"({condition.da.project.name})"
                )
            except Exception as e:
                logger.error(f"Condition overdue failed for condition {condition.pk}: {e}")

        return count

    def _process_milestone_overdue(self, today, cooldown):
        from apps.projects.models import DAMilestone
        from apps.notifications.notify import notify_da_milestone_overdue

        count = 0

        candidates = (
            DAMilestone.objects
            .filter(
                planned_date__lt=today,
                actual_date__isnull=True,
            )
            .filter(_not_recently_notified(cooldown))
            .select_related("da", "da__project", "da__project__organisation", "da__created_by")
        )

        for milestone in candidates:
            try:
                notify_da_milestone_overdue(milestone)
                milestone.last_notified_at = timezone.now()
                milestone.save(update_fields=["last_notified_at"])
                count += 1
                self.stdout.write(
                    f"  ✓ Milestone overdue — "
                    f"{milestone.display_label or milestone.milestone_type} "
                    f"({milestone.da.project.name})"
                )
            except Exception as e:
                logger.error(f"Milestone overdue failed for milestone {milestone.pk}: {e}")

        return count