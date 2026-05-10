from django.contrib import admin
from .models import Buyer, Agency, Agent, Solicitor, Referrer


@admin.register(Buyer)
class BuyerAdmin(admin.ModelAdmin):
    list_display  = ["__str__", "buyer_type", "email", "phone", "organisation", "id_verified"]
    list_filter   = ["buyer_type", "id_verified", "organisation"]
    search_fields = ["first_name", "last_name", "entity_name", "email"]


@admin.register(Agency)
class AgencyAdmin(admin.ModelAdmin):
    list_display  = ["name", "organisation", "email", "phone"]
    search_fields = ["name"]


@admin.register(Agent)
class AgentAdmin(admin.ModelAdmin):
    list_display  = ["__str__", "agency", "email", "is_active", "organisation"]
    list_filter   = ["is_active", "agency", "organisation"]
    search_fields = ["first_name", "last_name", "email"]


@admin.register(Solicitor)
class SolicitorAdmin(admin.ModelAdmin):
    list_display  = ["__str__", "firm_name", "email", "organisation"]
    search_fields = ["first_name", "last_name", "firm_name", "email"]


@admin.register(Referrer)
class ReferrerAdmin(admin.ModelAdmin):
    list_display  = ["__str__", "company_name", "email", "organisation"]
    search_fields = ["first_name", "last_name", "company_name", "email"]
