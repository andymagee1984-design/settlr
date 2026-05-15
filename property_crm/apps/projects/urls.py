from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import DevelopmentApplicationViewSet, DAConditionViewSet, DAMilestoneViewSet

router = DefaultRouter()
router.register("projects", views.ProjectViewSet, basename="project")
router.register("stages",   views.StageViewSet,   basename="stage")
router.register("lots",                  views.LotViewSet,                  basename="lot")
router.register("development-applications", DevelopmentApplicationViewSet, basename="da")
router.register("da-conditions",            DAConditionViewSet,            basename="da-condition")
router.register("da-milestones",            DAMilestoneViewSet,            basename="da-milestone")

urlpatterns = [path("", include(router.urls))]
