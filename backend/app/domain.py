"""Prototype reference data: route basket, weights, airlines, advance windows.

These are the *defaults*. At runtime they are stored in the `app_config` /
`routes` collections and are editable via Settings — nothing here is a hard-coded
source of truth for a running system (spec §11).
"""

from __future__ import annotations

# Advance-purchase windows in days (PRD §10).
ADVANCE_WINDOWS: tuple[int, ...] = (1, 7, 15, 30, 45)

# Documented base period for the experimental index (Index = 100 at this date).
BASE_PERIOD = "2026-08-01"

METHODOLOGY_VERSION = "proto-1.0.0"

# City metadata for display.
AIRPORTS: dict[str, dict[str, str]] = {
    "DEL": {"city": "Delhi", "name": "Indira Gandhi International"},
    "BOM": {"city": "Mumbai", "name": "Chhatrapati Shivaji Maharaj International"},
    "BLR": {"city": "Bengaluru", "name": "Kempegowda International"},
    "CCU": {"city": "Kolkata", "name": "Netaji Subhas Chandra Bose International"},
    "HYD": {"city": "Hyderabad", "name": "Rajiv Gandhi International"},
    "MAA": {"city": "Chennai", "name": "Chennai International"},
}

# Initial route basket + prototype weights (must sum to 1.0) — PRD §11.
ROUTE_BASKET: list[dict] = [
    {"route_id": "DEL-BOM", "origin": "DEL", "destination": "BOM", "weight": 0.25},
    {"route_id": "DEL-BLR", "origin": "DEL", "destination": "BLR", "weight": 0.20},
    {"route_id": "BOM-BLR", "origin": "BOM", "destination": "BLR", "weight": 0.20},
    {"route_id": "DEL-CCU", "origin": "DEL", "destination": "CCU", "weight": 0.15},
    {"route_id": "BLR-HYD", "origin": "BLR", "destination": "HYD", "weight": 0.10},
    {"route_id": "MAA-DEL", "origin": "MAA", "destination": "DEL", "weight": 0.10},
]

# Carriers represented in the synthetic dataset.
AIRLINES: list[dict] = [
    {"airline_id": "6E", "name": "IndiGo"},
    {"airline_id": "AI", "name": "Air India"},
    {"airline_id": "UK", "name": "Vistara"},
    {"airline_id": "SG", "name": "SpiceJet"},
    {"airline_id": "QP", "name": "Akasa Air"},
]

# Rough base fares (INR) per route at ~T+21, used only to seed synthetic data.
ROUTE_BASE_FARE: dict[str, int] = {
    "DEL-BOM": 5200,
    "DEL-BLR": 5600,
    "BOM-BLR": 4300,
    "DEL-CCU": 5000,
    "BLR-HYD": 3200,
    "MAA-DEL": 5240,
}


# Indian holidays / festivals for the optional event-impact analysis (PRD §Part 15).
# Dates are approximate for movable festivals and are configuration, not law —
# edit freely. The analysis only reports events whose travel window overlaps the
# data actually collected.
INDIA_EVENTS: list[dict] = [
    {"name": "Independence Day", "date": "2026-08-15", "type": "national_holiday"},
    {"name": "Raksha Bandhan", "date": "2026-08-28", "type": "festival"},
    {"name": "Janmashtami", "date": "2026-09-04", "type": "festival"},
    {"name": "Gandhi Jayanti", "date": "2026-10-02", "type": "national_holiday"},
    {"name": "Dussehra", "date": "2026-10-20", "type": "festival"},
    {"name": "Diwali", "date": "2026-11-08", "type": "festival"},
    {"name": "Christmas", "date": "2026-12-25", "type": "national_holiday"},
    {"name": "New Year", "date": "2027-01-01", "type": "national_holiday"},
    {"name": "Pongal / Makar Sankranti", "date": "2027-01-14", "type": "festival"},
]


def route_label(route_id: str) -> str:
    origin, _, dest = route_id.partition("-")
    return f"{origin} → {dest}"


def advance_window_label(advance_days: int) -> str:
    """Snap an arbitrary advance-purchase gap to the nearest prototype window."""
    nearest = min(ADVANCE_WINDOWS, key=lambda w: abs(w - advance_days))
    return f"T+{nearest}"


def nearest_window(advance_days: int) -> int:
    return min(ADVANCE_WINDOWS, key=lambda w: abs(w - advance_days))
