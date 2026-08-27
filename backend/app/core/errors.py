"""Application error types rendered into the standard §23 response envelope."""

from __future__ import annotations

from fastapi import status


class AppError(Exception):
    status_code: int = status.HTTP_400_BAD_REQUEST
    message: str = "Request could not be processed"

    def __init__(self, message: str | None = None) -> None:
        if message:
            self.message = message
        super().__init__(self.message)


class InvalidCredentials(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    message = "Incorrect email or password"


class NotFound(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    message = "Resource not found"


class UpstreamUnavailable(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    message = "Live flight data is temporarily unavailable"


class DatabaseUnavailable(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    message = "Data service is temporarily unavailable"
