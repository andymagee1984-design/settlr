from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0010_da_feasibility"),
    ]

    operations = [
        # ── Add feasibility fields to Project ──────────────────────────────
        migrations.AddField(
            model_name="project",
            name="feasibility",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    "Project feasibility: {scenarios: [{id, name, is_active, da_id, "
                    "notes, lines: [{lot_type, bedrooms, planned_count, avg_size_sqm, rate_per_sqm}]}]}"
                ),
            ),
        ),
        migrations.AddField(
            model_name="project",
            name="feasibility_committed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="project",
            name="feasibility_committed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        # ── Remove feasibility fields from DevelopmentApplication ──────────
        migrations.RemoveField(
            model_name="developmentapplication",
            name="feasibility",
        ),
        migrations.RemoveField(
            model_name="developmentapplication",
            name="feasibility_committed",
        ),
        migrations.RemoveField(
            model_name="developmentapplication",
            name="feasibility_committed_at",
        ),
    ]