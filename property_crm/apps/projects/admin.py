"""
apps/projects/admin.py
"""

from django.contrib import admin
from .models import Project, ProjectMedia, Stage, Lot, LotPriceHistory


class StageInline(admin.TabularInline):
    model  = Stage
    extra  = 1
    fields = ["name", "stage_number", "expected_release"]


class ProjectMediaInline(admin.TabularInline):
    model  = ProjectMedia
    extra  = 0
    fields = ["media_type", "category", "title", "file", "sort_order"]


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display  = ["name", "organisation", "status", "billing_status", "billing_lot_count", "billing_start_date"]
    list_filter   = ["status", "billing_status", "organisation"]
    search_fields = ["name", "address"]
    readonly_fields = ["billing_lot_count", "billing_start_date", "billing_end_date", "created_at", "updated_at"]
    inlines       = [StageInline, ProjectMediaInline]
    actions       = ["activate_projects"]

    fieldsets = [
        (None, {"fields": ["organisation", "name", "address", "status"]}),
        ("Marketing", {"fields": ["tagline", "description", "website_url", "solicitor"], "classes": ["collapse"]}),
        ("Billing", {"fields": ["billing_lot_count", "billing_start_date", "billing_end_date", "billing_status"]}),
        ("Timestamps", {"fields": ["created_at", "updated_at"], "classes": ["collapse"]}),
    ]

    def activate_projects(self, request, queryset):
        for project in queryset.filter(status="draft"):
            project.activate()
        self.message_user(request, "Selected draft projects have been activated.")
    activate_projects.short_description = "Activate selected projects"


class LotPriceHistoryInline(admin.TabularInline):
    model         = LotPriceHistory
    extra         = 0
    readonly_fields = ["changed_by", "created_at"]
    fields        = ["price", "effective_date", "reason", "changed_by", "created_at"]


@admin.register(Lot)
class LotAdmin(admin.ModelAdmin):
    list_display  = ["lot_number", "stage", "lot_type", "is_released", "current_price"]
    list_filter   = ["lot_type", "is_released", "stage__project"]
    search_fields = ["lot_number", "stage__project__name"]
    readonly_fields = ["created_at", "updated_at"]
    inlines       = [LotPriceHistoryInline]
