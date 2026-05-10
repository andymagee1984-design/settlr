"""
apps/sales/management/commands/process_on_hold_expiry.py

Railway cron target — runs every 5 minutes:
    python manage.py process_on_hold_expiry

Finds all On Hold sales past their on_hold_expiry, falls them over with
reason `tubed_buyer`, and emails the creating agent (console backend for POC).

Business-hours logic for on_hold_expiry *calculation* lives in services.py
(called at sale creation time). This command simply acts on whatever expiry
was already stored.
"""

from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.conf import settings

from apps.sales.services import auto_fall_over_expired_on_hold


class Command(BaseCommand):
    help = "Falls over any On Hold sales that have passed their expiry time."

    def handle(self, *args, **options):
        fallen = auto_fall_over_expired_on_hold()

        if not fallen:
            self.stdout.write("No expired On Hold sales found.")
            return

        self.stdout.write(f"Fell over {len(fallen)} sale(s):")
        for sale in fallen:
            self.stdout.write(f"  • Sale {sale.id} — {sale.lot}")
            self._notify_agent(sale)

    def _notify_agent(self, sale):
        agent_user = getattr(sale.created_by, None, None)
        recipient  = sale.created_by.email if sale.created_by else None
        if not recipient:
            return

        try:
            send_mail(
                subject=f"[Property CRM] On Hold expired — {sale.lot}",
                message=(
                    f"Hi {sale.created_by.first_name},\n\n"
                    f"The On Hold reservation for {sale.lot} has expired and the lot "
                    f"has been automatically released back to Available.\n\n"
                    f"If you still have an interested buyer, please start a new reservation.\n\n"
                    f"— Property CRM"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                fail_silently=True,
            )
        except Exception as e:
            self.stderr.write(f"Failed to send expiry email for sale {sale.id}: {e}")
