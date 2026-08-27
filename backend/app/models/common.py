"""Shared response envelope (API contract §23)."""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str = "Success"


def ok(data: T | None = None, message: str = "Success") -> ApiResponse[T]:
    return ApiResponse(success=True, data=data, message=message)


def fail(message: str, data: None = None) -> ApiResponse[None]:
    return ApiResponse(success=False, data=data, message=message)
