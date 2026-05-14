"""
apps/users/views.py
"""

from rest_framework import viewsets, generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import User, Role, CRMPermission
from .serializers import UserSerializer, UserCreateSerializer, RoleSerializer, CRMPermissionSerializer


class MeView(generics.RetrieveAPIView):
    """GET /api/v1/auth/me/ — returns the current user with their role and permissions."""
    permission_classes = [IsAuthenticated]
    serializer_class   = UserSerializer

    def get_object(self):
        return self.request.user


class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class   = UserSerializer

    def get_queryset(self):
        return User.objects.filter(
            organisation=self.request.user.organisation
        ).select_related('role').order_by('first_name', 'last_name')

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class   = RoleSerializer

    def get_queryset(self):
        return Role.objects.filter(
            organisation=self.request.user.organisation
        ) | Role.objects.filter(organisation__isnull=True)


class CRMPermissionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class   = CRMPermissionSerializer
    queryset           = CRMPermission.objects.all().order_by('category', 'code')


class UsersListView(generics.ListAPIView):
    """
    GET /api/v1/users/
    Returns all active users in the current organisation.
    Used by the frontend assignee dropdown when creating tasks.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        users = (
            User.objects
            .filter(organisation=request.user.organisation, is_active=True)
            .order_by('first_name', 'last_name')
            .values('id', 'first_name', 'last_name', 'email')
        )
        data = [
            {
                'id':        str(u['id']),
                'full_name': f"{u['first_name']} {u['last_name']}".strip(),
                'email':     u['email'],
            }
            for u in users
        ]
        return Response(data)