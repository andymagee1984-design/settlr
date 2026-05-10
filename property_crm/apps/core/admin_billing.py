"""
apps/core/admin_billing.py

Billing report view — accessible via /admin/core/organisation/billing-report/
Superusers only (enforced by admin_site.admin_view wrapper in OrganisationAdmin).
"""

from datetime import date
from decimal import Decimal

from django.db.models import Prefetch
from django.shortcuts import render

from .billing import calculate_project_billing, BILLING_TIERS


def billing_report_view(request):
    from apps.core.models import Organisation
    from apps.projects.models import Project

    orgs = (
        Organisation.objects
        .filter(billing_status="active")
        .prefetch_related(
            Prefetch(
                "projects",
                queryset=Project.objects.order_by("billing_start_date"),
            )
        )
        .order_by("name")
    )

    report = []
    grand_total = Decimal("0.00")

    for org in orgs:
        org_projects = []
        org_total = Decimal("0.00")

        for project in org.projects.all():
            summary = calculate_project_billing(project)
            summary["project"] = project
            org_projects.append(summary)
            org_total += summary["total_billed"]

        grand_total += org_total
        report.append({
            "org": org,
            "projects": org_projects,
            "org_total": org_total,
        })

    context = {
        "title": "Billing Report",
        "has_permission": True,
        "report": report,
        "grand_total": grand_total,
        "as_of": date.today(),
        "billing_tiers": BILLING_TIERS,
        "opts": {"app_label": "core"},
    }
    return render(request, "admin/core/billing_report.html", context)
