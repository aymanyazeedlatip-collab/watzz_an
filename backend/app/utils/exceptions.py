"""Custom errors and a consistent JSON error shape for the whole API.

WHAT THIS FILE DOES (plain language):
Instead of letting Python's raw error messages (which can look scary
and expose server details) reach the website, every deliberate error in
WATTZAN raises one of the classes below. FastAPI then converts it into
a clean, predictable JSON response like:

    {
      "error": {
        "code": "MODEL_NOT_LOADED",
        "message": "The production hybrid model is unavailable.",
        "details": "Expected artifact was not found.",
        "request_id": "..."
      }
    }

This keeps every error on the website looking and behaving the same
way, and never leaks a Python traceback or a server file path to the
user (tracebacks are still written to the log file for us to debug).
"""
from __future__ import annotations

import uuid


class WattzanError(Exception):
    """Base class for all deliberate, handled WATTZAN errors."""

    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(self, message: str, details: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details
        self.request_id = str(uuid.uuid4())

    def to_payload(self) -> dict:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
                "request_id": self.request_id,
            }
        }


class ValidationFailedError(WattzanError):
    status_code = 422
    code = "VALIDATION_FAILED"


class BadRequestError(WattzanError):
    status_code = 400
    code = "BAD_REQUEST"


class NotFoundError(WattzanError):
    status_code = 404
    code = "NOT_FOUND"


class FileTooLargeError(WattzanError):
    status_code = 413
    code = "FILE_TOO_LARGE"


class ModelUnavailableError(WattzanError):
    status_code = 503
    code = "MODEL_NOT_LOADED"


class ExternalServiceError(WattzanError):
    status_code = 502
    code = "EXTERNAL_SERVICE_ERROR"


class ServiceTimeoutError(WattzanError):
    status_code = 504
    code = "SERVICE_TIMEOUT"
