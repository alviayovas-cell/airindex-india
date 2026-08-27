"""Report builder endpoint (spec §22, §31, §Part 16).

`GET /api/reports` and the `/reports/{daily|weekly|monthly}` shortcuts return the
full report. `?format=json` (default) uses the standard envelope; `?format=csv`
streams the per-period rows; `?format=pdf` streams a government-style PDF.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.core.errors import AppError
from app.database.connection import get_database
from app.models.common import ApiResponse, ok
from app.models.index import Frequency
from app.models.user import UserPublic
from app.services.report_pdf import build_report_pdf
from app.services.report_service import build_full_report, report_rows_csv

router = APIRouter(tags=["reports"])

_FORMATS = {"json", "csv", "pdf"}


async def _report_response(
    db: AsyncIOMotorDatabase,
    *,
    date_from: str | None,
    date_to: str | None,
    route_id: str | None,
    frequency: Frequency,
    fmt: str,
):
    if fmt not in _FORMATS:
        raise AppError(f"format must be one of: {', '.join(sorted(_FORMATS))}")

    report = await build_full_report(
        db,
        date_from=date_from,
        date_to=date_to,
        route_id=route_id,
        frequency=frequency,
    )
    stamp = date.today().isoformat()
    base = f"airindex-{frequency.value}-report-{stamp}"

    if fmt == "csv":
        return Response(
            content=report_rows_csv(report),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{base}.csv"'},
        )
    if fmt == "pdf":
        return Response(
            content=build_report_pdf(report),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{base}.pdf"'},
        )
    return ok(report)


@router.get("/reports")
async def get_report(
    date_from: str | None = None,
    date_to: str | None = None,
    route_id: str | None = None,
    frequency: Frequency = Frequency.DAILY,
    format: str = Query("json", description="json | csv | pdf"),
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    return await _report_response(
        db,
        date_from=date_from,
        date_to=date_to,
        route_id=route_id,
        frequency=frequency,
        fmt=format,
    )


@router.get("/reports/{frequency}")
async def get_report_shortcut(
    frequency: Frequency,
    date_from: str | None = None,
    date_to: str | None = None,
    route_id: str | None = None,
    format: str = Query("json", description="json | csv | pdf"),
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    return await _report_response(
        db,
        date_from=date_from,
        date_to=date_to,
        route_id=route_id,
        frequency=frequency,
        fmt=format,
    )
