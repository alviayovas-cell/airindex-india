"""Data-access layer. API/services never touch Motor collections directly."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import hash_password
from app.models.user import UserInDB


def _now() -> datetime:
    return datetime.now(timezone.utc)


class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.col = db.users

    async def get_by_email(self, email: str) -> UserInDB | None:
        doc = await self.col.find_one({"email": email.lower()})
        if not doc:
            return None
        return UserInDB(
            id=str(doc["_id"]),
            email=doc["email"],
            name=doc.get("name", "Analyst"),
            role=doc.get("role", "analyst"),
            password_hash=doc["password_hash"],
            created_at=doc.get("created_at", _now()),
        )

    async def upsert_demo_user(self, email: str, password: str, name: str) -> None:
        existing = await self.col.find_one({"email": email.lower()})
        if existing:
            return
        await self.col.insert_one(
            {
                "email": email.lower(),
                "name": name,
                "role": "analyst",
                "password_hash": hash_password(password),
                "created_at": _now(),
            }
        )


class ConfigRepository:
    """Key/value store for runtime-editable configuration (index weights, base period…)."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.col = db.app_config

    async def get(self, key: str, default: Any = None) -> Any:
        doc = await self.col.find_one({"key": key})
        return doc["value"] if doc else default

    async def set(self, key: str, value: Any) -> None:
        await self.col.update_one(
            {"key": key},
            {"$set": {"value": value, "updated_at": _now()}},
            upsert=True,
        )
