# apps/projects/migrations/0010_da_feasibility.py

from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0009_da_comments_activity_owner"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="target_gr",
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=14, null=True,
                help_text="Target gross revenue committed from DA feasibility",
            ),
        ),
        migrations.AddField(
            model_name="developmentapplication",
            name="feasibility",
            field=models.JSONField(
                default=dict, blank=True,
                help_text="Feasibility model: {lines: [{lot_type, planned_count, avg_size_sqm, rate_per_sqm}], notes: str}",
            ),
        ),
        migrations.AddField(
            model_name="developmentapplication",
            name="feasibility_committed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="developmentapplication",
            name="feasibility_committed_at",
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]