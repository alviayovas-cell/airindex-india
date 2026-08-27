"""Analytics: lead-time and route heatmap (§22)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.database.connection import get_database
from app.models.common import ApiResponse, ok
from app.models.user import UserPublic
from app.services.analytics_service import (
    airline_overview,
    lead_time_analysis,
    route_heatmap,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/lead-time", response_model=ApiResponse[dict])
async def get_lead_time(
    route: str | None = None,
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(await lead_time_analysis(db, route))


@router.get("/routes", response_model=ApiResponse[dict])
async def get_route_heatmap(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    rows = await route_heatmap(db)
    changes = [r["change_7d"] for r in rows if r["change_7d"] is not None]
    return ok(
        {
            "routes": rows,
            "range": {
                "min": min(changes) if changes else None,
                "max": max(changes) if changes else None,
            },
        }
    )


@router.get("/airlines", response_model=ApiResponse[dict])
async def get_airline_comparison(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok({"airlines": await airline_overview(db)})
