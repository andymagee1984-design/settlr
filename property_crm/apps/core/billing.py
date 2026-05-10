"""
apps/core/billing.py

Billing tier logic for the Property CRM platform.

POC: Tiers and prices are hardcoded here for demo purposes.
Production: Replace BILLING_TIERS with a database-driven lookup
or pull from a settings/config table when pricing is formalised.
"""

from datetime import date
from decimal import Decimal


# ---------------------------------------------------------------------------
# Tier table — swap these values out when real pricing is confirmed
# ---------------------------------------------------------------------------

BILLING_TIERS = [
    {"max_lots": 25,   "monthly_fee": Decimal("299.00"),  "label": "Starter (1–25 lots)"},
    {"max_lots": 75,   "monthly_fee": Decimal("599.00"),  "label": "Growth (26–75 lots)"},
    {"max_lots": 150,  "monthly_fee": Decimal("999.00"),  "label": "Scale (76–150 lots)"},
    {"max_lots": None, "monthly_fee": Decimal("1499.00"), "label": "Enterprise (151+ lots)"},
]


def get_tier(lot_count: int) -> dict:
    for tier in BILLING_TIERS:
        if tier["max_lots"] is None or lot_count <= tier["max_lots"]:
            return tier
    return BILLING_TIERS[-1]


def months_between(start: date, end: date) -> int:
    if end is None:
        end = date.today()
    delta_months = (end.year - start.year) * 12 + (end.month - start.month)
    return max(delta_months, 1)


def calculate_project_billing(project) -> dict:
    if not project.billing_start_date:
        return {
            "lot_count": project.billing_lot_count or 0,
            "tier_label": "—",
            "monthly_fee": Decimal("0.00"),
            "billing_start": None,
            "billing_end": None,
            "months_billed": 0,
            "total_billed": Decimal("0.00"),
            "status": "not_activated",
        }

    lot_count = project.billing_lot_count or 0
    tier = get_tier(lot_count)
    end = project.billing_end_date
    months = months_between(project.billing_start_date, end or date.today())

    return {
        "lot_count": lot_count,
        "tier_label": tier["label"],
        "monthly_fee": tier["monthly_fee"],
        "billing_start": project.billing_start_date,
        "billing_end": end,
        "months_billed": months,
        "total_billed": tier["monthly_fee"] * months,
        "status": project.billing_status or "active",
    }
