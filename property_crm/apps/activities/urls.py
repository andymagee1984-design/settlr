from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("activities", views.ActivityViewSet, basename="activity")

urlpatterns = [path("", include(router.urls))]
