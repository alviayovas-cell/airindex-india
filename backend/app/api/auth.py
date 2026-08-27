"""Authentication endpoints (§22: POST /api/auth/login)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_user_repo
from app.database.repositories import UserRepository
from app.models.common import ApiResponse, ok
from app.models.user import LoginRequest, TokenData, UserPublic
from app.services.auth_service import authenticate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=ApiResponse[TokenData])
async def login(
    body: LoginRequest,
    users: UserRepository = Depends(get_user_repo),
) -> ApiResponse[TokenData]:
    token = await authenticate(body, users)
    return ok(token, message="Login successful")


@router.get("/me", response_model=ApiResponse[UserPublic])
async def me(
    current: UserPublic = Depends(get_current_user),
) -> ApiResponse[UserPublic]:
    return ok(current)
