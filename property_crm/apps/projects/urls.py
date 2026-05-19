from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import DevelopmentApplicationViewSet, DAConditionViewSet, DAMilestoneViewSet, DADocumentViewSet

router = DefaultRouter()
router.register("projects", views.ProjectViewSet, basename="project")
router.register("stages",   views.StageViewSet,   basename="stage")
router.register("lots",                  views.LotViewSet,                  basename="lot")
router.register("development-applications", DevelopmentApplicationViewSet, basename="da")
router.register("da-conditions",            DAConditionViewSet,            basename="da-condition")
router.register("da-milestones",            DAMilestoneViewSet,            basename="da-milestone")
router.register("da-documents", DADocumentViewSet, basename="da-document")

urlpatterns = [path("", include(router.urls))]
