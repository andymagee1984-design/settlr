"""
apps/projects/migrations/0009_da_comments_activity_owner.py

Adds:
  - DevelopmentApplication.owner (FK → User, nullable)
  - DAComment model
  - ConditionComment model
  - DAActivityLog model
"""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0008_dadocument"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [

        # ── Owner field on DevelopmentApplication ──────────────────────────
        migrations.AddField(
            model_name="developmentapplication",
            name="owner",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="owned_das",
                to=settings.AUTH_USER_MODEL,
                verbose_name="Owner",
                help_text="Internal user responsible for managing this DA",
            ),
        ),

        # ── DAComment ───────────────────────────────────────────────────────
        migrations.CreateModel(
            name="DAComment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("body", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "da",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to="projects.developmentapplication",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["created_at"],
                "verbose_name": "DA Comment",
                "verbose_name_plural": "DA Comments",
            },
        ),

        # ── ConditionComment ────────────────────────────────────────────────
        migrations.CreateModel(
            name="ConditionComment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("body", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "condition",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to="projects.dacondition",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["created_at"],
                "verbose_name": "Condition Comment",
                "verbose_name_plural": "Condition Comments",
            },
        ),

        # ── DAActivityLog ───────────────────────────────────────────────────
        migrations.CreateModel(
            name="DAActivityLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "event_type",
                    models.CharField(
                        max_length=50,
                        choices=[
                            ("status_changed",           "Status Changed"),
                            ("condition_status_changed", "Condition Status Changed"),
                            ("condition_added",          "Condition Added"),
                            ("milestone_added",          "Milestone Added"),
                            ("milestone_updated",        "Milestone Updated"),
                            ("document_uploaded",        "Document Uploaded"),
                            ("document_deleted",         "Document Deleted"),
                            ("owner_assigned",           "Owner Assigned"),
                            ("comment_added",            "Comment Added"),
                        ],
                    ),
                ),
                ("description", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "da",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activity_log",
                        to="projects.developmentapplication",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["created_at"],
                "verbose_name": "DA Activity Log",
                "verbose_name_plural": "DA Activity Logs",
            },
        ),
    ]