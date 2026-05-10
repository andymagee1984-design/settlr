from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("sales",       views.SaleViewSet,       basename="sale")
router.register("commissions", views.CommissionViewSet, basename="commission")

urlpatterns = [path("", include(router.urls))]
