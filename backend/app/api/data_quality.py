"""Data quality + source health (spec §19, §Part 12)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.database.connection import get_database
from app.models.common import ApiResponse, ok
from app.models.user import UserPublic
from app.services.data_quality_service import data_quality

router = APIRouter(tags=["data-quality"])


@router.get("/data-quality", response_model=ApiResponse[dict])
async def get_data_quality(
    date_from: str | None = None,
    date_to: str | None = None,
    route_id: str | None = None,
    airline: str | None = None,
    source: str | None = None,
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(
        await data_quality(
            db,
            date_from=date_from,
            date_to=date_to,
            route_id=route_id,
            airline=airline,
            source=source,
        )
    )
