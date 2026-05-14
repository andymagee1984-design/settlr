"""
config/api_urls.py

All /api/v1/ routes. Grouped by app.
Auth routes use SimpleJWT views directly — no custom wrapper needed.
"""

from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    # Auth
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),

    # App routers (each app exposes its own router)
    path("", include("apps.core.urls")),
    path("", include("apps.users.urls")),
    path("", include("apps.contacts.urls")),
    path("", include("apps.projects.urls")),
    path("", include("apps.sales.urls")),
    path("", include("apps.activities.urls")),
    path("", include("apps.dashboard.urls")),
    path("", include("apps.notifications.urls")),
]