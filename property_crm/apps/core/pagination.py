"""
apps/core/pagination.py

Cursor-based pagination used across all list endpoints.
"""

from rest_framework.pagination import CursorPagination as _CursorPagination


class CursorPagination(_CursorPagination):
    page_size = 50
    ordering = "-created_at"
