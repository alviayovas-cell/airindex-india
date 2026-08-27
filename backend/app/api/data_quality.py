"""Data quality + source health (§19, §22)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.config import settings
from app.database.connection import get_database
from app.database.repositories import (
    CollectionRunRepository,
    DataQualityRepository,
)
from app.models.common import ApiResponse, ok
from app.models.user import UserPublic

router = APIRouter(tags=["data-quality"])


@router.get("/data-quality", response_model=ApiResponse[dict])
async def get_data_quality(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    quality_repo = DataQualityRepository(db)
    totals = await quality_repo.totals()
    latest = await quality_repo.latest()
    daily = await quality_repo.daily()
    run = await CollectionRunRepository(db).latest()

    total = totals.get("total", 0)
    valid = totals.get("valid", 0)
    breakdown = {
        "total": total,
        "valid": valid,
        "missing": totals.get("missing", 0),
        "duplicate": totals.get("duplicate", 0),
        "outlier": totals.get("outlier", 0),
        "cancelled": totals.get("cancelled", 0),
        "sold_out": totals.get("sold_out", 0),
    }

    sources = []
    if run:
        sources.append(
            {
                "name": run.get("source", "unknown"),
                "status": {
                    "success": "healthy",
                    "partial": "partial",
                    "failed": "failed",
                }.get(run.get("status", ""), "unknown"),
                "last_collection": run.get("completed_at"),
                "records_collected": run.get("records_stored", 0),
                "errors": run.get("errors", []),
                "duration_seconds": run.get("duration_seconds"),
                "is_synthetic": run.get("is_synthetic", True),
            }
        )
    if settings.amadeus_configured and (not run or run.get("source") != "amadeus"):
        sources.append(
            {
                "name": "amadeus",
                "status": "healthy",
                "last_collection": None,
                "records_collected": 0,
                "errors": [],
                "is_synthetic": False,
            }
        )

    return ok(
        {
            "overall_quality_pct": round(100.0 * valid / total, 1) if total else None,
            "breakdown": breakdown,
            "latest_day": latest,
            "daily": daily,
            "sources": sources,
        }
    )
