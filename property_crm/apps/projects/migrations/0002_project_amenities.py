"""
Migration: add amenities to Project
apps/projects/migrations/0002_project_amenities.py

Adds a JSONField to Project that stores a list of enabled amenity codes.
e.g. ["pool", "gym", "rooftop_garden"]

The field is nullable so existing projects are unaffected — amenities
simply show as an empty list if not set.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="amenities",
            field=models.JSONField(
                default=list,
                blank=True,
                help_text=(
                    "List of enabled amenity codes for this project. "
                    "Valid codes: pool, gym, rooftop_garden, co_working, "
                    "sauna, yoga_studio, parking, pet_area, tennis_court, "
                    "bbq_area, concierge, spa."
                ),
            ),
        ),
    ]