"""Route + airline models."""

from __future__ import annotations

from pydantic import BaseModel


class Route(BaseModel):
    route_id: str
    origin: str
    destination: str
    origin_city: str | None = None
    destination_city: str | None = None
    weight: float
    active: bool = True


class RouteStat(BaseModel):
    route_id: str
    origin: str
    destination: str
    weight: float
    average_fare: float | None = None
    current_index: float | None = None
    change_7d: float | None = None
    change_30d: float | None = None
    observation_count: int = 0


class Airline(BaseModel):
    airline_id: str
    name: str
    active: bool = True
