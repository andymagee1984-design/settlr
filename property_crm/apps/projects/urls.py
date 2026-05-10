from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("projects", views.ProjectViewSet, basename="project")
router.register("stages",   views.StageViewSet,   basename="stage")
router.register("lots",     views.LotViewSet,     basename="lot")

urlpatterns = [path("", include(router.urls))]
