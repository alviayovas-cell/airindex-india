"""Shared FastAPI dependencies."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.core.security import decode_access_token
from app.database.connection import Database, get_database
from app.database.repositories import ConfigRepository, UserRepository
from app.models.user import UserPublic

_bearer = HTTPBearer(auto_error=False)


def get_user_repo(
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> UserRepository:
    return UserRepository(db)


def get_config_repo(
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ConfigRepository:
    return ConfigRepository(db)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    users: UserRepository = Depends(get_user_repo),
) -> UserPublic:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # Offline degraded mode: DB unreachable but token belongs to the demo account.
    if not await Database.ping():
        if payload["sub"].lower() == settings.demo_user_email.lower():
            return UserPublic(
                id="offline-demo",
                email=settings.demo_user_email,
                name=str(payload.get("name", "Demo Analyst")),
                role=str(payload.get("role", "analyst")),
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists"
        )

    user = await users.get_by_email(payload["sub"])
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )
    return UserPublic(id=user.id, email=user.email, name=user.name, role=user.role)
