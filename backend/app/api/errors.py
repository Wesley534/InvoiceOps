# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Global exception handlers producing the standard error envelope.

Every error response shares the same shape (HTTP status codes are kept):

    {
      "success": false,
      "error": {
        "code": "not_found",          # machine-readable
        "message": "Vendor V-999 not found",
        "details": [                  # optional; field-level for 422s
          {"field": "email", "message": "value is not a valid email address"}
        ]
      }
    }
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("app.api.errors")

# Human-friendly code per HTTP status. Unknown statuses fall back to the
# numeric status so the code field is always present and meaningful.
_CODE_BY_STATUS: Dict[int, str] = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    410: "gone",
    422: "validation_error",
    429: "rate_limited",
    500: "internal_error",
    503: "unavailable",
}


def _code_for(status_code: int) -> str:
    return _CODE_BY_STATUS.get(status_code, "error_%d" % status_code)


def error_body(
    code: str,
    message: str,
    details: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    body: Dict[str, Any] = {
        "success": False,
        "error": {"code": code, "message": message},
    }
    if details:
        body["error"]["details"] = details
    return body


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """HTTPException (raised by routes and auth dependencies, and by Starlette
    for unknown routes / wrong methods)."""
    message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(_code_for(exc.status_code), message),
        headers=exc.headers,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """422 request-validation failures: return field-level details."""
    details: List[Dict[str, Any]] = []
    for err in exc.errors():
        location = [str(part) for part in err.get("loc", ()) if part != "body"]
        field = ".".join(location) or "$"
        details.append(
            {
                "field": field,
                "message": err.get("msg", "Invalid value"),
                "type": err.get("type", ""),
            }
        )
    return JSONResponse(
        status_code=422,
        content=error_body(
            "validation_error",
            "Request validation failed",
            details=details,
        ),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Any other exception: never leak internals, but log the traceback."""
    logger.exception(
        "Unhandled exception serving %s %s", request.method, request.url.path
    )
    return JSONResponse(
        status_code=500,
        content=error_body("internal_error", "Internal server error"),
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
