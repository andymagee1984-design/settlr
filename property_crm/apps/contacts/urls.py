"""
apps/contacts/urls.py
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("buyers",     views.BuyerViewSet,    basename="buyer")
router.register("agencies",   views.AgencyViewSet,   basename="agency")
router.register("agents",     views.AgentViewSet,    basename="agent")
router.register("solicitors", views.SolicitorViewSet, basename="solicitor")
router.register("referrers",  views.ReferrerViewSet,  basename="referrer")
router.register("prospects",  views.ProspectViewSet,  basename="prospect")

urlpatterns = [
    path("", include(router.urls)),

    # Public endpoints — no authentication required
    path(
        "enquiries/<str:form_token>/",
        views.PublicEnquiryView.as_view(),
        name="public-enquiry",
    ),
    path(
        "webhooks/portal/<str:org_token>/",
        views.PortalWebhookView.as_view(),
        name="portal-webhook",
    ),
]