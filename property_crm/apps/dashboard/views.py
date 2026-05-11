"""
apps/dashboard/views.py

Single endpoint returning all data needed for the dashboard landing page.
Designed to be called once on page load — no N+1, no waterfalls.

GET /api/v1/dashboard/
"""

from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, Q, Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.models import Lot, Project
from apps.sales.models import Sale
from apps.activities.models import Activity


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = request.user.organisation
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # ── Projects ──────────────────────────────────────────────────────────
        projects = (
            Project.objects
            .filter(organisation=org, status="active")
            .prefetch_related("stages")
        )

        project_summaries = []
        for p in projects:
            total_lots = Lot.objects.filter(stage__project=p).count()
            settled = Lot.objects.filter(
                stage__project=p,
                sales__status="settled",
            ).count()
            active_sales = Sale.objects.filter(
                lot__stage__project=p,
            ).exclude(status__in=["fallen_over", "settled"]).count()
            project_summaries.append({
                "id": str(p.id),
                "name": p.name,
                "status": p.status,
                "total_lots": total_lots,
                "settled_lots": settled,
                "active_sales": active_sales,
                "stage_count": p.stages.count(),
            })

        # ── Portfolio metrics ─────────────────────────────────────────────────
        all_lots = Lot.objects.filter(stage__project__organisation=org)
        total_lots = all_lots.count()
        settled_lots = all_lots.filter(sales__status="settled").count()
        on_market = all_lots.filter(
            is_released=True
        ).exclude(sales__status="settled").count()

        # On hold expiring within 4 hours
        expiring_soon = Sale.objects.filter(
            organisation=org,
            status="on_hold",
            on_hold_expiry__lte=now + timedelta(hours=4),
            on_hold_expiry__gte=now,
        ).count()

        # Active sales count
        active_sales_count = Sale.objects.filter(
            organisation=org,
        ).exclude(status__in=["fallen_over", "settled"]).count()

        # ── Pipeline breakdown ────────────────────────────────────────────────
        pipeline_counts = (
            Sale.objects
            .filter(organisation=org)
            .exclude(status__in=["fallen_over"])
            .values("status")
            .annotate(count=Count("id"))
        )
        pipeline = {row["status"]: row["count"] for row in pipeline_counts}

        # ── Pending approvals ─────────────────────────────────────────────────
        pending_sales = (
            Sale.objects
            .filter(organisation=org, status="pending")
            .select_related("primary_buyer", "lot__stage__project")
            .order_by("created_at")[:5]
        )
        pending = []
        for s in pending_sales:
            buyer = s.primary_buyer
            pending.append({
                "id": str(s.id),
                "buyer_name": f"{buyer.first_name} {buyer.last_name}".strip() if buyer else "—",
                "buyer_initials": (
                    f"{buyer.first_name[:1]}{buyer.last_name[:1]}".upper()
                    if buyer else "?"
                ),
                "lot_number": s.lot.lot_number,
                "project_name": s.lot.stage.project.name,
                "sale_price": str(s.sale_price) if s.sale_price else None,
            })

        # ── Recent activities ─────────────────────────────────────────────────
        activities_qs = (
            Activity.objects
            .filter(organisation=org)
            .select_related("assigned_to", "created_by")
            .order_by("-created_at")[:8]
        )
        activities = []
        for a in activities_qs:
            activities.append({
                "id": str(a.id),
                "activity_type": a.activity_type,
                "subject": a.subject,
                "sale_id": str(a.sale_id) if a.sale_id else None,
                "assigned_to_name": (
                    f"{a.assigned_to.first_name} {a.assigned_to.last_name}".strip()
                    if a.assigned_to else None
                ),
                "created_at": a.created_at.isoformat(),
                "completed_at": a.completed_at.isoformat() if a.completed_at else None,
                "due_date": a.due_date.isoformat() if a.due_date else None,
            })

        # ── My tasks ──────────────────────────────────────────────────────────
        my_tasks_qs = (
            Activity.objects
            .filter(
                organisation=org,
                activity_type="task",
                assigned_to=request.user,
                completed_at__isnull=True,
            )
            .select_related("sale__lot__stage__project")
            .order_by("due_date")[:6]
        )
        my_tasks = []
        for t in my_tasks_qs:
            my_tasks.append({
                "id": str(t.id),
                "subject": t.subject,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "sale_id": str(t.sale_id) if t.sale_id else None,
                "lot_number": (
                    t.sale.lot.lot_number
                    if t.sale and t.sale.lot else None
                ),
                "project_name": (
                    t.sale.lot.stage.project.name
                    if t.sale and t.sale.lot else None
                ),
            })

        # ── This month stats ──────────────────────────────────────────────────
        new_sales = Sale.objects.filter(
            organisation=org,
            created_at__gte=month_start,
        ).exclude(status="fallen_over").count()

        fallen_over = Sale.objects.filter(
            organisation=org,
            fallen_over_at__gte=month_start,
        ).count()

        settled_this_month = Sale.objects.filter(
            organisation=org,
            status="settled",
            settled_at__gte=month_start,
        ).count()

        revenue_settled = Sale.objects.filter(
            organisation=org,
            status="settled",
            settled_at__gte=month_start,
        ).aggregate(total=Sum("sale_price"))["total"] or 0

        return Response({
            "user": {
                "first_name": request.user.first_name,
                "last_name": request.user.last_name,
                "role_name": request.user.role.name if request.user.role else None,
            },
            "metrics": {
                "total_lots": total_lots,
                "on_market": on_market,
                "settled_lots": settled_lots,
                "active_sales": active_sales_count,
                "expiring_soon": expiring_soon,
            },
            "pipeline": pipeline,
            "projects": project_summaries,
            "pending_approvals": pending,
            "recent_activities": activities,
            "my_tasks": my_tasks,
            "this_month": {
                "new_sales": new_sales,
                "fallen_over": fallen_over,
                "settled": settled_this_month,
                "revenue_settled": str(revenue_settled),
            },
        })