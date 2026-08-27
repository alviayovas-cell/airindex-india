"""Health / system status endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app import __version__
from app.config import settings
from app.database.connection import Database
from app.models.common import ApiResponse, ok

router = APIRouter(tags=["meta"])


@router.get("/health", response_model=ApiResponse[dict])
async def health() -> ApiResponse[dict]:
    db_ok = await Database.ping()
    return ok(
        {
            "status": "ok",
            "version": __version__,
            "time": datetime.now(timezone.utc).isoformat(),
            "database_connected": db_ok,
            "amadeus_configured": settings.amadeus_configured,
            "environment": settings.app_env,
        }
    )
