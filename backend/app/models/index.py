"""Airfare Price Index models."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Frequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class IndexPoint(BaseModel):
    date: str  # ISO date (daily) or period label (weekly/monthly)
    frequency: Frequency
    index_value: float
    observation_count: int = 0
    routes_covered: int = 0
    change_pct: float | None = None  # vs previous point of same frequency


class IndexValue(IndexPoint):
    base_period: str
    methodology_version: str
    route_index: dict[str, float] = Field(default_factory=dict)
    computed_at: datetime | None = None


class CurrentIndex(BaseModel):
    index_value: float
    base_period: str
    current_period: str
    methodology_version: str
    change_1d: float | None = None
    change_7d: float | None = None
    change_30d: float | None = None
    observation_count: int
    routes_covered: int
    sparkline: list[float] = Field(default_factory=list)
    status_label: str
    is_experimental: bool = True


class MethodologyDoc(BaseModel):
    methodology_version: str
    base_period: str
    index_formula: str
    price_standardization: str
    advance_windows: list[int]
    route_basket: list[dict]
    weights: dict[str, float]
    weights_sum: float
    data_quality_rules: list[str]
    missing_data_rule: str
    outlier_rule: str
    data_sources: list[str]
    disclaimer: str
