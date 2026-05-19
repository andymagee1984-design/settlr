"""
config/api_urls.py
All /api/v1/ routes. Grouped by app.
Auth routes use SimpleJWT views directly — no custom wrapper needed.
"""
from django.urls import path, include
from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Clears the httpOnly refresh token cookie.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        cookie_name = getattr(settings, 'SIMPLE_JWT', {}).get(
            'AUTH_COOKIE', 'refresh'
        )
        response = Response({"detail": "Logged out."})
        response.delete_cookie(cookie_name, path="/", samesite="Lax")
        return response


urlpatterns = [
    # Auth
    path("auth/token/",         TokenObtainPairView.as_view(), name="token_obtain"),
    path("auth/token/refresh/", TokenRefreshView.as_view(),    name="token_refresh"),
    path("auth/token/verify/",  TokenVerifyView.as_view(),     name="token_verify"),
    path("auth/logout/",        LogoutView.as_view(),          name="logout"),

    # App routers
    path("", include("apps.core.urls")),
    path("", include("apps.users.urls")),
    path("", include("apps.contacts.urls")),
    path("", include("apps.projects.urls")),
    path("", include("apps.sales.urls")),
    path("", include("apps.activities.urls")),
    path("", include("apps.dashboard.urls")),
    path("", include("apps.notifications.urls")),
]