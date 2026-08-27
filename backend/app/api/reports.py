"""Report builder endpoint (§22, §31)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.database.connection import get_database
from app.models.common import ApiResponse, ok
from app.models.index import Frequency
from app.models.user import UserPublic
from app.services.report_service import build_report

router = APIRouter(tags=["reports"])


@router.get("/reports", response_model=ApiResponse[dict])
async def get_report(
    date_from: str | None = None,
    date_to: str | None = None,
    route_id: str | None = None,
    frequency: Frequency = Frequency.DAILY,
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(
        await build_report(
            db,
            date_from=date_from,
            date_to=date_to,
            route_id=route_id,
            frequency=frequency,
        )
    )
