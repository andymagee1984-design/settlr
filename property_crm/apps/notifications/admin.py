"""
apps/notifications/admin.py
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import Notification, SalesAdviceLog


@admin.register(SalesAdviceLog)
class SalesAdviceLogAdmin(admin.ModelAdmin):
    list_display    = ["sale_link", "organisation", "status_badge", "recipients_display", "sent_at"]
    list_filter     = ["status", "organisation", "sent_at"]
    search_fields   = ["sale__id", "recipients"]
    readonly_fields = ["id", "organisation", "sale", "status", "recipients", "error", "sent_at"]
    ordering        = ["-sent_at"]

    def has_add_permission(self, request):    return False
    def has_change_permission(self, request, obj=None): return False

    def sale_link(self, obj):
        url = f"/admin/sales/sale/{obj.sale_id}/change/"
        return format_html('<a href="{}">{}</a>', url, str(obj.sale_id)[:8] + "…")
    sale_link.short_description = "Sale"

    def status_badge(self, obj):
        colour = "#16a34a" if obj.status == "sent" else "#dc2626"
        return format_html('<span style="color:{}; font-weight:600;">{}</span>', colour, obj.get_status_display())
    status_badge.short_description = "Status"

    def recipients_display(self, obj):
        return obj.recipients[:80] + ("…" if len(obj.recipients) > 80 else "")
    recipients_display.short_description = "Recipients"


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display  = ["title", "recipient", "notif_type", "is_read", "created_at"]
    list_filter   = ["notif_type", "is_read", "organisation"]
    search_fields = ["title", "message", "recipient__email"]
    readonly_fields = ["id", "organisation", "recipient", "notif_type", "title", "message", "sale", "is_read", "read_at", "created_at"]
    ordering      = ["-created_at"]

    def has_add_permission(self, request):    return False
    def has_change_permission(self, request, obj=None): return False