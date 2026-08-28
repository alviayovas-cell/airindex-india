"""Health / system status endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app import __version__
from app.config import settings
from app.database.connection import Database
from app.ml.paths import prediction_deps_installed
from app.models.common import ApiResponse, ok
from app.services.report_pdf import PDF_AVAILABLE

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
            "features": {
                "pdf_export": PDF_AVAILABLE,
                "fare_prediction": prediction_deps_installed(),
                "ai_assistant": settings.ai_configured,
            },
        }
    )
