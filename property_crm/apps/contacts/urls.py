from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("buyers",     views.BuyerViewSet,    basename="buyer")
router.register("agencies",   views.AgencyViewSet,   basename="agency")
router.register("agents",     views.AgentViewSet,    basename="agent")
router.register("solicitors", views.SolicitorViewSet, basename="solicitor")
router.register("referrers",  views.ReferrerViewSet,  basename="referrer")

urlpatterns = [path("", include(router.urls))]
