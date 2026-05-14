"""
apps/notifications/views.py
"""

from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    sale_id      = serializers.UUIDField(source="sale.id",                     read_only=True, allow_null=True)
    lot_number   = serializers.CharField(source="sale.lot.lot_number",         read_only=True, allow_null=True)
    project_name = serializers.CharField(source="sale.lot.stage.project.name", read_only=True, allow_null=True)

    class Meta:
        model  = Notification
        fields = [
            "id", "notif_type", "title", "message",
            "sale_id", "lot_number", "project_name",
            "is_read", "read_at", "created_at",
        ]
        read_only_fields = fields


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Notification.objects
            .filter(
                organisation=self.request.user.organisation,
                recipient=self.request.user,
            )
            .select_related("sale__lot__stage__project")
            .order_by("-created_at")
        )

    @action(detail=False, methods=["post"], url_path="mark_read")
    def mark_all_read(self, request):
        now = timezone.now()
        updated = Notification.objects.filter(
            organisation=request.user.organisation,
            recipient=request.user,
            is_read=False,
        ).update(is_read=True, read_at=now)
        return Response({"marked_read": updated})

    @action(detail=True, methods=["post"], url_path="read")
    def mark_one_read(self, request, pk=None):
        notif = self.get_object()
        if not notif.is_read:
            notif.is_read = True
            notif.read_at = timezone.now()
            notif.save(update_fields=["is_read", "read_at"])
        return Response(NotificationSerializer(notif).data)