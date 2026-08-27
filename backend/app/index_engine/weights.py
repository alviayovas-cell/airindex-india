"""Route-basket weights (PRD §11, §16).

Weights are runtime-editable (stored in `app_config`), must be positive and are
always renormalized to sum to exactly 1.0 before use.
"""

from __future__ import annotations

from app.domain import ROUTE_BASKET


class WeightError(ValueError):
    pass


def default_weights() -> dict[str, float]:
    return {r["route_id"]: float(r["weight"]) for r in ROUTE_BASKET}


def normalize_weights(weights: dict[str, float]) -> dict[str, float]:
    clean = {k: float(v) for k, v in weights.items() if v is not None and float(v) > 0}
    if not clean:
        raise WeightError("No positive route weights provided")
    total = sum(clean.values())
    return {k: v / total for k, v in clean.items()}


def subset_weights(weights: dict[str, float], available: set[str]) -> dict[str, float]:
    """Renormalize over the routes that actually have data for a period.

    This is the documented missing-data rule: a route with no valid observation
    is excluded and its weight is redistributed proportionally (PRD §17).
    """
    present = {k: v for k, v in weights.items() if k in available}
    if not present:
        raise WeightError("No weighted routes have data for this period")
    total = sum(present.values())
    return {k: v / total for k, v in present.items()}
