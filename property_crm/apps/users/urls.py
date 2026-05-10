"""
apps/users/urls.py
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("users", views.UserViewSet, basename="user")
router.register("roles", views.RoleViewSet, basename="role")
router.register("permissions", views.CRMPermissionViewSet, basename="permission")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/me/", views.MeView.as_view(), name="auth-me"),
]
