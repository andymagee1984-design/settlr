"""
apps/users/views.py
"""

from django.db import models
from rest_framework import viewsets, generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import HasPermission
from .models import User, Role, CRMPermission
from .serializers import UserSerializer, UserCreateSerializer, RoleSerializer, CRMPermissionSerializer


class MeView(generics.RetrieveAPIView):
    """GET /api/v1/auth/me/ — returns the current user with their role and permissions."""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasPermission("admin.users")]

    def get_queryset(self):
        return User.objects.filter(organisation=self.request.user.organisation).select_related("role")

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        org = self.request.user.organisation
        # Return system roles + org-specific roles
        return Role.objects.filter(
            models.Q(organisation=org) | models.Q(organisation__isnull=True)
        ).prefetch_related("permissions")


class CRMPermissionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CRMPermissionSerializer
    permission_classes = [IsAuthenticated, HasPermission("admin.users")]
    queryset = CRMPermission.objects.all()
