"""
apps/core/exceptions.py

Custom exception handler that normalises all API errors to:

    {
        "error": "validation_error",
        "detail": "Human-readable message",
        "fields": { "field_name": ["error detail"] }   # only on validation errors
    }
"""

from rest_framework.views import exception_handler
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response


def crm_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        return None

    if isinstance(exc, ValidationError):
        data = {
            "error": "validation_error",
            "detail": "One or more fields are invalid.",
            "fields": response.data,
        }
    else:
        detail = response.data.get("detail", str(exc))
        data = {
            "error": _get_error_code(response.status_code),
            "detail": str(detail),
        }

    response.data = data
    return response


def _get_error_code(status_code: int) -> str:
    return {
        400: "bad_request",
        401: "authentication_required",
        403: "permission_denied",
        404: "not_found",
        405: "method_not_allowed",
        409: "conflict",
        422: "unprocessable",
        429: "rate_limited",
        500: "server_error",
    }.get(status_code, "error")
