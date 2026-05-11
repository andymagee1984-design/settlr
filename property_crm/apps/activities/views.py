"""
apps/activities/views.py
"""

from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Activity
from .serializers import ActivitySerializer


class ActivityViewSet(viewsets.ModelViewSet):
    serializer_class   = ActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            Activity.objects
            .for_org(self.request.user.organisation)
            .select_related("sale", "assigned_to", "created_by")
        )

        params = self.request.query_params
        if params.get("contact_type") and params.get("contact_id"):
            qs = qs.filter(
                Q(contact_type=params["contact_type"], contact_id=params["contact_id"]) |
                Q(sale__primary_buyer_id=params["contact_id"])
            )
        if params.get("sale"):
            qs = qs.filter(sale_id=params["sale"])
        if params.get("activity_type"):
            qs = qs.filter(activity_type=params["activity_type"])
        if params.get("assigned_to"):
            qs = qs.filter(assigned_to_id=params["assigned_to"])
        if params.get("incomplete_tasks"):
            qs = qs.filter(activity_type="task", completed_at__isnull=True)

        return qs

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """POST /activities/{id}/complete/ — marks a task as done."""
        activity = self.get_object()
        if activity.activity_type != Activity.ActivityType.TASK:
            return Response(
                {"error": "bad_request", "detail": "Only tasks can be marked complete."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if activity.is_complete:
            return Response(
                {"error": "bad_request", "detail": "Task is already complete."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        activity.completed_at = timezone.now()
        activity.save(update_fields=["completed_at"])
        return Response(ActivitySerializer(activity).data)