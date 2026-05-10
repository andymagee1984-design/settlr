"""
config/settings/local.py

Local development overrides. Never deploy this.
"""

from .base import *

DEBUG = True

ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite dev server
]

# Use console email in local dev
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
