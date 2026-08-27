"""Index methodology (§27, §30, §22)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.database.connection import get_database
from app.models.common import ApiResponse, ok
from app.models.user import UserPublic
from app.services.analytics_service import methodology

router = APIRouter(tags=["methodology"])


@router.get("/methodology", response_model=ApiResponse[dict])
async def get_methodology(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(await methodology(db))
