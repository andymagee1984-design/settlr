"""
LOCATION: property_crm/apps/projects/migrations/0005_da_notification_timestamps.py

NOTE: Check your actual last migration filename in apps/projects/migrations/
and update the dependency below before running. Common names would be something
like 0004_developmentapplication or 0004_da_module — whatever yours is.

Run after dropping in:
    python manage.py migrate
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        # ↓ Replace with your actual last projects migration name
        ("projects", "0005_da_planning_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="developmentapplication",
            name="last_notified_at",
            field=models.DateTimeField(
                null=True,
                blank=True,
                help_text=(
                    "Timestamp of the last DA-level notification sent (lapse warning). "
                    "Used by process_da_notifications to prevent duplicate daily alerts."
                ),
            ),
        ),
        migrations.AddField(
            model_name="dacondition",
            name="last_notified_at",
            field=models.DateTimeField(
                null=True,
                blank=True,
                help_text=(
                    "Timestamp of the last condition-level notification sent "
                    "(overdue or due-soon). Used by process_da_notifications "
                    "to prevent duplicate daily alerts."
                ),
            ),
        ),
        migrations.AddField(
            model_name="damilestone",
            name="last_notified_at",
            field=models.DateTimeField(
                null=True,
                blank=True,
                help_text=(
                    "Timestamp of the last milestone-level notification sent (overdue). "
                    "Used by process_da_notifications to prevent duplicate daily alerts."
                ),
            ),
        ),
    ]