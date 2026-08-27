"""Airfare quote models and enums (PRD §17, §18)."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class QuoteStatus(str, Enum):
    VALID = "valid"
    MISSING = "missing"
    OUTLIER = "outlier"
    DUPLICATE = "duplicate"
    CANCELLED = "cancelled"
    SOLD_OUT = "sold_out"


# Statuses whose fares are trusted for index calculation.
INDEX_ELIGIBLE = {QuoteStatus.VALID}


class RawQuote(BaseModel):
    """What a collector emits before the cleaning pipeline runs."""

    route_id: str
    origin: str
    destination: str
    airline: str
    flight_number: str | None = None
    travel_date: str  # ISO date
    collected_at: datetime
    advance_days: int
    cabin: str = "Economy"
    fare_class: str = "standard"
    base_fare: float | None = None
    taxes: float | None = None
    fees: float | None = None
    total_fare: float | None = None
    currency: str = "INR"
    availability: bool = True
    source: str
    #: optional provider signal: "sold_out", "cancelled", "ok" …
    provider_status: str | None = None


class AirfareQuote(RawQuote):
    """A cleaned, stored observation."""

    advance_window: str  # e.g. "T+15"
    status: QuoteStatus = QuoteStatus.VALID
    quality_flags: list[str] = Field(default_factory=list)
    dedupe_key: str | None = None
    is_synthetic: bool = False
    collection_date: str  # ISO date of collected_at, for daily grouping


class AirfareQuoteOut(BaseModel):
    """Table row shape for the API / dashboard."""

    id: str
    collected_at: datetime
    collection_date: str
    origin: str
    destination: str
    route_id: str
    airline: str
    travel_date: str
    advance_days: int
    advance_window: str
    fare_class: str
    cabin: str
    base_fare: float | None
    taxes: float | None
    fees: float | None
    total_fare: float | None
    currency: str
    source: str
    status: QuoteStatus
    quality_flags: list[str]
    is_synthetic: bool
