"""
apps/activities/management/commands/send_due_notifications.py

Sends in-app notifications for activity due dates.
Run daily via cron or Railway scheduler.

Three notification states per task (each fires once):
  - due_tomorrow  : due date is tomorrow
  - due_today     : due date is today
  - overdue       : due date has passed, task still incomplete

Tracks which notifications have already been sent via the
Notification model to avoid duplicates.

Railway cron (production): set CRON_SCHEDULE to "0 8 * * *" (8am daily)
Local dev: python manage.py send_due_notifications
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = "Send due date notifications for incomplete activities"

    def handle(self, *args, **options):
        from apps.activities.models import Activity
        from apps.notifications.models import Notification

        now   = timezone.now()
        today = now.date()
        tomorrow = today + timedelta(days=1)

        # Find all incomplete activities with a due date
        activities = (
            Activity.objects
            .filter(completed_at__isnull=True, due_date__isnull=False)
            .select_related("assigned_to", "organisation", "sale__lot__stage__project")
            .exclude(assigned_to__isnull=True)
        )

        sent = 0
        skipped = 0

        for activity in activities:
            due = activity.due_date

            # Normalise — due_date may be a datetime or a date
            if hasattr(due, 'date'):
                due_date = due.date()
            else:
                due_date = due

            # Determine which state applies
            if due_date == tomorrow:
                notif_type  = "due_tomorrow"
                title       = f"Due tomorrow — {activity.subject}"
                message     = (
                    f"Your activity \"{activity.subject}\" is due tomorrow "
                    f"({due_date.strftime('%d %B %Y')})."
                )
            elif due_date == today:
                notif_type  = "due_today"
                title       = f"Due today — {activity.subject}"
                message     = (
                    f"Your activity \"{activity.subject}\" is due today. "
                    f"Mark it complete when done."
                )
            elif due_date < today:
                notif_type  = "overdue"
                title       = f"Overdue — {activity.subject}"
                message     = (
                    f"Your activity \"{activity.subject}\" was due on "
                    f"{due_date.strftime('%d %B %Y')} and is still incomplete."
                )
            else:
                # Not yet due
                continue

            # Check if this exact notification has already been sent
            already_sent = Notification.objects.filter(
                organisation=activity.organisation,
                recipient=activity.assigned_to,
                notif_type=notif_type,
                sale=activity.sale,
                title=title,
            ).exists()

            if already_sent:
                skipped += 1
                continue

            # Create the notification
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
                self.stderr.write(f"Failed to create notification for activity {activity.id}: {e}")

        self.stdout.write(
            self.style.SUCCESS(
                f"send_due_notifications complete: {sent} sent, {skipped} already sent."
            )
        )