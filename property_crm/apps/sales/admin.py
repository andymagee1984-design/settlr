"""
apps/sales/admin.py
"""

from django.contrib import admin
from .models import Sale, Deposit, Commission


class DepositInline(admin.StackedInline):
    model       = Deposit
    extra       = 0
    readonly_fields = ["created_by", "created_at"]
    can_delete  = False


class CommissionInline(admin.StackedInline):
    model       = Commission
    extra       = 0
    readonly_fields = ["calculated_amount", "approved_by", "approved_at", "paid_at"]
    can_delete  = False


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display   = [
        "id", "lot", "primary_buyer", "agent", "status",
        "sale_price", "on_hold_expiry", "created_at",
    ]
    list_filter    = ["status", "organisation", "cooling_off_waived", "subject_to_finance"]
    search_fields  = [
        "primary_buyer__first_name", "primary_buyer__last_name",
        "primary_buyer__entity_name",
        "lot__lot_number", "lot__stage__project__name",
    ]
    readonly_fields = [
        "on_hold_expiry", "approved_by", "approved_at",
        "fallen_over_at", "settled_at", "created_at", "updated_at",
    ]
    inlines        = [DepositInline, CommissionInline]

    fieldsets = [
        (None, {"fields": ["organisation", "lot", "status"]}),
        ("Parties", {"fields": ["primary_buyer", "secondary_buyer", "agent", "solicitor", "referrer"]}),
        ("Sale details", {"fields": ["sale_price", "id_verified", "cooling_off_waived", "cooling_off_expiry", "subject_to_finance", "finance_due_date"]}),
        ("On Hold", {"fields": ["on_hold_expiry"], "classes": ["collapse"]}),
        ("Approval", {"fields": ["approved_by", "approved_at", "created_by"], "classes": ["collapse"]}),
        ("Fall Over", {"fields": ["fallen_over_at", "fallen_over_reason"], "classes": ["collapse"]}),
        ("Stage transitions", {"fields": [
            "contract_issued_date", "contract_document",
            "exchange_date", "signed_contract",
            "settlement_date", "settlement_statement", "settled_at",
        ], "classes": ["collapse"]}),
        ("Timestamps", {"fields": ["created_at", "updated_at"], "classes": ["collapse"]}),
    ]


@admin.register(Commission)
class CommissionAdmin(admin.ModelAdmin):
    list_display  = ["sale", "agent", "commission_type", "calculated_amount", "status"]
    list_filter   = ["status", "commission_type"]
    readonly_fields = ["calculated_amount", "approved_by", "approved_at", "paid_at"]
