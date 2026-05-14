"""
apps/activities/management/commands/send_due_notifications.py

Sends in-app notifications for activity due dates.
Run daily via cron or Railway scheduler: python manage.py send_due_notifications

Notification rules:
  Assigned user gets notified for: due_tomorrow, due_today, overdue
  Sales Manager / Admin gets notified for: due_today, overdue (urgent only)

Each notification fires once per task per state (no duplicates).
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

URGENT_TYPES = {"due_today", "overdue"}


class Command(BaseCommand):
    help = "Send due date notifications for incomplete activities"

    def handle(self, *args, **options):
        from apps.activities.models import Activity
        from apps.notifications.models import Notification
        from apps.users.models import User

        today    = timezone.now().date()
        tomorrow = today + timedelta(days=1)

        activities = (
            Activity.objects
            .filter(completed_at__isnull=True, due_date__isnull=False)
            .select_related(
                "assigned_to",
                "assigned_to__role",
                "organisation",
                "sale__lot__stage__project",
            )
            .exclude(assigned_to__isnull=True)
        )

        sent    = 0
        skipped = 0

        for activity in activities:
            due = activity.due_date
            due_date = due.date() if hasattr(due, 'date') else due

            # Determine notification state
            if due_date == tomorrow:
                notif_type = "due_tomorrow"
                title      = f"Due tomorrow — {activity.subject}"
                message    = (
                    f"\"{activity.subject}\" is due tomorrow "
                    f"({due_date.strftime('%d %B %Y')})."
                )
            elif due_date == today:
                notif_type = "due_today"
                title      = f"Due today — {activity.subject}"
                message    = (
                    f"\"{activity.subject}\" is due today. "
                    f"Mark it complete when done."
                )
            elif due_date < today:
                notif_type = "overdue"
                title      = f"Overdue — {activity.subject}"
                message    = (
                    f"\"{activity.subject}\" was due on "
                    f"{due_date.strftime('%d %B %Y')} and is still incomplete."
                )
            else:
                continue

            # ── 1. Notify the assigned user ──────────────────────────────────
            already_sent = Notification.objects.filter(
                organisation=activity.organisation,
                recipient=activity.assigned_to,
                notif_type=notif_type,
                title=title,
            ).exists()

            if already_sent:
                skipped += 1
            else:
                try:
                    Notification.objects.create(
                        organisation=activity.organisation,
                        recipient=activity.assigned_to,
                        notif_type=notif_type,
                        title=title,
                        message=message,
                        sale=activity.sale,
                    )
                    sent += 1
                except Exception as e:
                    self.stderr.write(f"Failed to notify assigned user for activity {activity.id}: {e}")

            # ── 2. Notify Sales Managers / Admins (urgent states only) ────────
            if notif_type not in URGENT_TYPES:
                continue

            assigned_name = (
                f"{activity.assigned_to.first_name} {activity.assigned_to.last_name}".strip()
                if activity.assigned_to else "A team member"
            )

            manager_title = f"Team activity {notif_type.replace('_', ' ')} — {activity.subject}"
            if notif_type == "due_today":
                due_detail = "Due today."
            else:
                due_detail = f"Was due {due_date.strftime('%d %B %Y')}."

            manager_message = (
                f"{assigned_name}'s activity \"{activity.subject}\" "
                f"{'is due today' if notif_type == 'due_today' else 'is overdue'}. "
                f"{due_detail}"
            )

            managers = User.objects.filter(
                organisation=activity.organisation,
                is_active=True,
                role__name__in=["Admin", "Sales Manager"],
            ).exclude(
                id=activity.assigned_to_id  # Don't double-notify if manager assigned to themselves
            )

            for manager in managers:
                already_sent_manager = Notification.objects.filter(
                    organisation=activity.organisation,
                    recipient=manager,
                    notif_type=notif_type,
                    title=manager_title,
                ).exists()

                if already_sent_manager:
                    skipped += 1
                else:
                    try:
                        Notification.objects.create(
                            organisation=activity.organisation,
                            recipient=manager,
                            notif_type=notif_type,
                            title=manager_title,
                            message=manager_message,
                            sale=activity.sale,
                        )
                        sent += 1
                    except Exception as e:
                        self.stderr.write(f"Failed to notify manager {manager.id} for activity {activity.id}: {e}")

        self.stdout.write(
            self.style.SUCCESS(
                f"send_due_notifications complete: {sent} sent, {skipped} already sent."
            )
        )