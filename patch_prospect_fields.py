"""
patch_prospect_fields.py
Run from: C:\Users\andy.magee\Downloads\property_crm

Usage:
    python patch_prospect_fields.py
"""

import os
import re

BASE = os.path.dirname(os.path.abspath(__file__))
MODELS_PATH = os.path.join(BASE, "property_crm", "apps", "contacts", "models.py")
SERIAL_PATH = os.path.join(BASE, "property_crm", "apps", "contacts", "serializers.py")

# ─────────────────────────────────────────────────────────────────────────────
# Patch models.py — insert budget_min, budget_max, purchase_intent after notes
# ─────────────────────────────────────────────────────────────────────────────

NEW_FIELDS = '''
    # Budget range
    budget_min = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    budget_max = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Purchase intent
    purchase_intent = models.CharField(
        max_length=20,
        choices=[
            ('investor',       'Investor'),
            ('owner_occupier', 'Owner occupier'),
            ('undecided',      'Undecided'),
        ],
        default='undecided',
        blank=True,
    )
'''

with open(MODELS_PATH, "r", encoding="utf-8") as f:
    models_content = f.read()

if "purchase_intent" in models_content:
    print("models.py: purchase_intent already exists — skipping.")
else:
    # Insert after the notes field line in the Prospect class
    models_content = models_content.replace(
        "    notes = models.TextField(blank=True)\n\n    # Returning buyer detection",
        "    notes = models.TextField(blank=True)\n" + NEW_FIELDS + "\n    # Returning buyer detection",
    )
    with open(MODELS_PATH, "w", encoding="utf-8") as f:
        f.write(models_content)
    print("models.py: budget_min, budget_max, purchase_intent added.")

# ─────────────────────────────────────────────────────────────────────────────
# Patch serializers.py — add fields to ProspectSerializer fields list
# ─────────────────────────────────────────────────────────────────────────────

with open(SERIAL_PATH, "r", encoding="utf-8") as f:
    serial_content = f.read()

if '"budget_min"' in serial_content and '"purchase_intent"' in serial_content:
    print("serializers.py: fields already present — skipping.")
else:
    serial_content = serial_content.replace(
        '"engagement_level",\n            "converted_at", "created_at",',
        '"engagement_level",\n            "budget_min", "budget_max",\n            "purchase_intent",\n            "converted_at", "created_at",',
    )
    with open(SERIAL_PATH, "w", encoding="utf-8") as f:
        f.write(serial_content)
    print("serializers.py: budget_min, budget_max, purchase_intent added.")

print("\nDone. Now run:")
print("  python property_crm/manage.py makemigrations contacts")
print("  python property_crm/manage.py migrate")
