"""
config/settings/local.py

Local development overrides. Never deploy this.
"""

from .base import *

DEBUG = True

ALLOWED_HOSTS = ALLOWED_HOSTS = ['localhost', '127.0.0.1', '10.1.1.249']

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite dev server
]

# SMTP email — swap EMAIL_HOST_PASSWORD for your Gmail app password
# To generate: Google Account → Security → 2-Step Verification → App Passwords
EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = 'smtp.gmail.com'
EMAIL_PORT          = 587
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = 'andymagee1984@gmail.com'
EMAIL_HOST_PASSWORD = 'jvjv gdnh brdj pkji'
DEFAULT_FROM_EMAIL  = 'andymagee1984@gmail.com'