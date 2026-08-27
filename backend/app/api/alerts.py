"""Fare-spike alerts (spec §Part 8)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.database.connection import get_database
from app.models.common import ApiResponse, ok
from app.models.user import UserPublic
from app.services.spike_service import detect_fare_spikes

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/fare-spikes", response_model=ApiResponse[dict])
async def get_fare_spikes(
    window_days: int = Query(7, ge=2, le=45),
    by_airline: bool = Query(False),
    route_id: str | None = None,
    airline: str | None = None,
    severity: str | None = None,
    date_to: str | None = None,
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(
        await detect_fare_spikes(
            db,
            window_days=window_days,
            by_airline=by_airline,
            route_id=route_id,
            airline=airline,
            severity=severity,
            date_to=date_to,
        )
    )
