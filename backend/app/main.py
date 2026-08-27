"""AIRINDEX FastAPI application entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import __version__
from app.api import (
    ai,
    airlines,
    alerts,
    analytics,
    auth,
    backtest,
    collection,
    config as config_api,
    data_quality,
    flights,
    index,
    meta,
    methodology,
    overview,
    reports,
    routes,
)
from app.config import settings
from app.core.errors import AppError
from app.database.connection import Database, ensure_indexes
from app.services.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("airindex")


@asynccontextmanager
async def lifespan(app: FastAPI):
    connected = await Database.ping()
    if connected:
        try:
            await ensure_indexes()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not ensure indexes: %s", exc)
    else:
        logger.warning("Starting in DEGRADED mode — MongoDB not reachable")
    start_scheduler()
    yield
    stop_scheduler()
    await Database.close()


app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description="Real-time Airfare Price Intelligence for India — hackathon prototype",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Standard §23 error envelope for every failure path ----
def _envelope(message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "data": None, "message": message},
    )


@app.exception_handler(AppError)
async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return _envelope(exc.message, exc.status_code)


@app.exception_handler(RequestValidationError)
async def _validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    loc = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    msg = first.get("msg", "Invalid request")
    return _envelope(f"{loc}: {msg}" if loc else msg, 422)


@app.exception_handler(StarletteHTTPException)
async def _http_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return _envelope(detail, exc.status_code)


@app.exception_handler(PyMongoError)
async def _mongo_handler(_: Request, exc: PyMongoError) -> JSONResponse:
    logger.warning("MongoDB error: %s", exc)
    return _envelope(
        "Data service is temporarily unavailable. Check the MongoDB connection.", 503
    )


@app.exception_handler(Exception)
async def _unhandled_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error: %s", exc)
    return _envelope("An unexpected error occurred", 500)


# ---- Routes ----
for module in (
    meta,
    auth,
    overview,
    index,
    routes,
    airlines,
    flights,
    analytics,
    data_quality,
    collection,
    methodology,
    backtest,
    reports,
    config_api,
    alerts,
    ai,
):
    app.include_router(module.router, prefix=settings.api_prefix)


@app.get("/")
async def root() -> dict:
    return {"name": settings.app_name, "version": __version__, "docs": "/docs"}
