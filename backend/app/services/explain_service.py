"""Index transparency (spec §Part 6 & §Part 11).

Two read-only views over the *stored* daily ``IndexValue`` docs and the configured
weights — nothing here recomputes the index:

* ``index_calculation`` — the per-route weight / route-index / contribution table
  for one day, whose rows sum to the published index value.
* ``index_explain``     — the largest *observed contributors* to the change between
  two days. Deliberately worded as "observed", never causal.
"""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.repositories import (
    AirfareQuoteRepository,
    ConfigRepository,
    IndexRepository,
)
from app.domain import ADVANCE_WINDOWS, route_label
from app.index_engine.weights import default_weights, normalize_weights
from app.services.index_service import INDEX_FORMULA

_CONTRIBUTION_DISCLAIMER = (
    "Observed contributors only: these are the largest measured movements between "
    "the two periods, not a causal explanation of why fares moved."
)


async def _weights(db: AsyncIOMotorDatabase) -> dict[str, float]:
    raw = await ConfigRepository(db).get("index.weights") or default_weights()
    return normalize_weights(raw)


def _effective_weights(
    weights: dict[str, float], routes_present: list[str]
) -> dict[str, float]:
    """Renormalize configured weights over the routes that actually have an index
    on the day (the documented missing-data rule)."""
    present = {r: weights[r] for r in routes_present if r in weights}
    total = sum(present.values())
    if total <= 0:
        return {r: 0.0 for r in routes_present}
    return {r: w / total for r, w in present.items()}


async def index_calculation(
    db: AsyncIOMotorDatabase, date: str | None = None
) -> dict | None:
    daily = await IndexRepository(db).daily_series()
    if not daily:
        return None
    by_date = {d["date"]: d for d in daily}
    target = by_date.get(date) if date else daily[-1]
    if target is None:
        return None

    weights = await _weights(db)
    route_index: dict[str, float] = target.get("route_index") or {}
    eff = _effective_weights(weights, list(route_index))

    rows = []
    for r in sorted(route_index):
        contribution = eff.get(r, 0.0) * route_index[r]
        rows.append(
            {
                "route_id": r,
                "label": route_label(r),
                "weight": round(weights.get(r, 0.0), 4),
                "effective_weight": round(eff.get(r, 0.0), 4),
                "route_index": round(route_index[r], 2),
                "contribution": round(contribution, 3),
            }
        )

    return {
        "date": target["date"],
        "available_dates": [d["date"] for d in daily],
        "base_period": target.get("base_period"),
        "methodology_version": target.get("methodology_version"),
        "formula": INDEX_FORMULA,
        "index_value": target["index_value"],
        "recomputed_from_rows": round(sum(x["contribution"] for x in rows), 2),
        "rows": rows,
        "routes_missing": sorted(set(weights) - set(route_index)),
        "note": (
            "Contribution = effective weight x route index. Effective weights "
            "renormalize over the routes with data on the day."
        ),
    }


async def index_explain(
    db: AsyncIOMotorDatabase,
    date: str | None = None,
    compare: str | None = None,
) -> dict | None:
    daily = await IndexRepository(db).daily_series()
    if not daily:
        return None
    by_date = {d["date"]: d for d in daily}
    cur = by_date.get(date) if date else daily[-1]
    if cur is None:
        return None

    if compare and compare in by_date:
        prev = by_date[compare]
    else:
        i = next(k for k, d in enumerate(daily) if d["date"] == cur["date"])
        prev = daily[i - 1] if i > 0 else None

    if prev is None or prev["date"] == cur["date"]:
        return {
            "available": False,
            "message": "Need at least two index days to explain a change.",
            "date": cur["date"],
        }

    weights = await _weights(db)
    cur_ri: dict[str, float] = cur.get("route_index") or {}
    prev_ri: dict[str, float] = prev.get("route_index") or {}
    cur_eff = _effective_weights(weights, list(cur_ri))
    prev_eff = _effective_weights(weights, list(prev_ri))

    fares = await AirfareQuoteRepository(db).route_window_avg_fare(
        [cur["date"], prev["date"]]
    )
    cur_f = fares.get(cur["date"], {})
    prev_f = fares.get(prev["date"], {})

    contributors = []
    for r in sorted(set(cur_ri) & set(prev_ri)):
        cur_c = cur_eff.get(r, 0.0) * cur_ri[r]
        prev_c = prev_eff.get(r, 0.0) * prev_ri[r]
        cf = cur_f.get(r, {}).get("avg")
        pf = prev_f.get(r, {}).get("avg")
        contributors.append(
            {
                "route_id": r,
                "label": route_label(r),
                "weight": round(weights.get(r, 0.0), 4),
                "route_index_now": round(cur_ri[r], 2),
                "route_index_prev": round(prev_ri[r], 2),
                "route_index_change": round(cur_ri[r] - prev_ri[r], 2),
                "contribution_now": round(cur_c, 3),
                "contribution_prev": round(prev_c, 3),
                "contribution_delta": round(cur_c - prev_c, 3),
                "avg_fare_now": round(cf, 0) if cf else None,
                "avg_fare_prev": round(pf, 0) if pf else None,
                "avg_fare_change_pct": round(100.0 * (cf - pf) / pf, 2)
                if cf and pf
                else None,
            }
        )
    contributors.sort(key=lambda c: abs(c["contribution_delta"]), reverse=True)

    largest = max(
        contributors, key=lambda c: abs(c["route_index_change"]), default=None
    )
    most_window = None
    if largest is not None:
        cw = cur_f.get(largest["route_id"], {}).get("windows", {})
        pw = prev_f.get(largest["route_id"], {}).get("windows", {})
        best: tuple[str, float] | None = None
        for w in ADVANCE_WINDOWS:
            k = f"T+{w}"
            if cw.get(k) and pw.get(k):
                chg = abs(100.0 * (cw[k] - pw[k]) / pw[k])
                if best is None or chg > best[1]:
                    best = (k, chg)
        if best is not None:
            most_window = {"window": best[0], "abs_change_pct": round(best[1], 2)}

    prev_val = prev["index_value"]
    return {
        "available": True,
        "date": cur["date"],
        "compare_date": prev["date"],
        "available_dates": [d["date"] for d in daily],
        "index_now": cur["index_value"],
        "index_prev": prev_val,
        "index_change": round(cur["index_value"] - prev_val, 2),
        "index_change_pct": round(
            100.0 * (cur["index_value"] - prev_val) / prev_val, 2
        )
        if prev_val
        else None,
        "observed_contributors": contributors,
        "largest_observed_movement": {
            "route_id": largest["route_id"],
            "label": largest["label"],
            "route_index_change": largest["route_index_change"],
        }
        if largest is not None
        else None,
        "most_affected_window": most_window,
        "disclaimer": _CONTRIBUTION_DISCLAIMER,
    }
