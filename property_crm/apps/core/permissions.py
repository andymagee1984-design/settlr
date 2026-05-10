"""
apps/core/permissions.py

DRF permission class that checks a user's Role for a given CRM permission code.

Usage:
    class MyView(APIView):
        permission_classes = [IsAuthenticated, HasPermission("sale.approve")]
"""

from rest_framework.permissions import BasePermission


def HasPermission(code: str):
    """
    Factory that returns a DRF permission class checking for `code`.
    Superusers always pass. Users without an organisation always fail.
    """

    class _HasPermission(BasePermission):
        def has_permission(self, request, view):
            user = request.user
            if not user or not user.is_authenticated:
                return False
            if user.is_superuser:
                return True
            return user.has_crm_permission(code)

    _HasPermission.__name__ = f"HasPermission_{code}"
    return _HasPermission
