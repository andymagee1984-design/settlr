from django.contrib import admin
from .models import Activity


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display  = ["activity_type", "subject", "contact_type", "sale", "assigned_to", "activity_date", "is_complete"]
    list_filter   = ["activity_type", "contact_type", "organisation"]
    search_fields = ["subject", "description"]
    readonly_fields = ["created_by", "created_at", "updated_at"]
