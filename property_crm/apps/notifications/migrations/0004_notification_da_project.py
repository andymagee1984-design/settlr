"""
LOCATION: property_crm/apps/notifications/migrations/0002_notification_da_project.py

NOTE: Check your actual last notifications migration filename and update the
dependency below before running.

Run after dropping in:
    python manage.py migrate
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
    ("notifications", "0003_alter_notification_notif_type_and_more"),
    ("projects", "0006_da_notification_timestamps"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="da",
            field=models.ForeignKey(
                to="projects.DevelopmentApplication",
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
                related_name="notifications",
                help_text="Linked DA for DA-type notifications. Null for sale notifications.",
            ),
        ),
        migrations.AddField(
            model_name="notification",
            name="project",
            field=models.ForeignKey(
                to="projects.Project",
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
                related_name="notifications",
                help_text=(
                    "Denormalised project FK — enables frontend routing to the correct "
                    "project DA tab without an extra API call."
                ),
            ),
        ),
    ]