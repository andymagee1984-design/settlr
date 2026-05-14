"""
apps/core/admin.py
"""

from django.contrib import admin
from django.urls import path

from .models import Organisation
from .admin_billing import billing_report_view


@admin.register(Organisation)
class OrganisationAdmin(admin.ModelAdmin):
    list_display  = ["name", "slug", "default_state", "billing_status", "created_at"]
    list_filter   = ["billing_status", "default_state"]
    search_fields = ["name", "slug"]
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = [
        (None, {
            "fields": ["name", "slug"],
        }),
        ("Defaults", {
            "fields": ["default_state", "cooling_off_days", "holding_deposit_default"],
        }),
        ("Billing", {
            "fields": ["billing_status"],
        }),
        ("Notifications", {
            "fields": ["notification_emails"],
            "description": "Comma-separated email addresses that receive a copy of every sales advice (e.g. developer@example.com,accounts@example.com).",
        }),
        ("Timestamps", {
            "fields": ["created_at", "updated_at"],
            "classes": ["collapse"],
        }),
    ]

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                "billing-report/",
                self.admin_site.admin_view(billing_report_view),
                name="core_billing_report",
            ),
        ]
        return custom + urls

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context["billing_report_url"] = "billing-report/"
        return super().changelist_view(request, extra_context=extra_context)