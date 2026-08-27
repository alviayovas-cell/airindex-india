"""Dashboard overview — one call for the KPI row (§6, §34)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.database.connection import get_database
from app.models.common import ApiResponse, ok
from app.models.user import UserPublic
from app.services.analytics_service import dashboard_overview

router = APIRouter(tags=["overview"])


@router.get("/overview", response_model=ApiResponse[dict])
async def get_overview(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(await dashboard_overview(db))
