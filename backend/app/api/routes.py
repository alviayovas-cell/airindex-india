"""Route basket + route-level analysis (§22)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.database.connection import get_database
from app.models.common import ApiResponse, ok
from app.models.user import UserPublic
from app.services.analytics_service import route_detail, route_stats

router = APIRouter(prefix="/routes", tags=["routes"])


@router.get("", response_model=ApiResponse[dict])
async def list_routes(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    stats = await route_stats(db)
    return ok(
        {
            "routes": stats,
            "count": len(stats),
            "weights_sum": round(sum(s["weight"] for s in stats), 4),
        }
    )


@router.get("/{route_id}", response_model=ApiResponse[dict])
async def get_route(
    route_id: str,
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    detail = await route_detail(db, route_id)
    if detail is None:
        raise HTTPException(404, f"Route {route_id} is not in the basket")
    return ok(detail)
