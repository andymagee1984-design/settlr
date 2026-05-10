"""
apps/users/admin.py
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, Role, CRMPermission, RolePermission


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ["email", "get_full_name", "organisation", "role", "is_active", "is_staff"]
    list_filter   = ["is_active", "is_staff", "organisation", "role"]
    search_fields = ["email", "first_name", "last_name"]
    ordering      = ["email"]
    readonly_fields = ["created_at", "last_login"]

    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Personal info", {"fields": ["first_name", "last_name"]}),
        ("Organisation", {"fields": ["organisation", "role", "agent"]}),
        ("Permissions", {"fields": ["is_active", "is_staff", "is_superuser", "groups", "user_permissions"]}),
        ("Timestamps", {"fields": ["created_at", "last_login"], "classes": ["collapse"]}),
    ]
    add_fieldsets = [
        (None, {
            "classes": ["wide"],
            "fields": ["email", "first_name", "last_name", "organisation", "role", "password1", "password2"],
        }),
    ]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display  = ["name", "organisation", "is_system_role"]
    list_filter   = ["is_system_role", "organisation"]
    # permissions uses a custom through model (RolePermission) so
    # filter_horizontal is not available — manage via RolePermission inline


@admin.register(CRMPermission)
class CRMPermissionAdmin(admin.ModelAdmin):
    list_display  = ["code", "category", "description"]
    list_filter   = ["category"]
    search_fields = ["code", "description"]
