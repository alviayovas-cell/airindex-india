"""Cleaning & normalization pipeline (PRD §15, §18).

    raw -> schema validation -> type normalization -> duplicate detection
        -> missing-value rules -> outlier flagging -> fare-component normalization
        -> validity status -> index-ready quote

Suspicious records are never dropped; they are retained with a `status` and
`quality_flags`.
"""

from __future__ import annotations

import hashlib
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

from app.models.airfare import AirfareQuote, QuoteStatus, RawQuote
from app.processors.normalizer import normalize
from app.processors.outlier import (
    DEFAULT_THRESHOLD,
    flag_outliers,
    flag_outliers_iqr,
)

#: currencies the INR-denominated prototype index can use directly
SUPPORTED_CURRENCIES = {"INR"}


@dataclass
class CleaningResult:
    quotes: list[AirfareQuote]
    counts: dict[str, int] = field(default_factory=dict)

    @property
    def total(self) -> int:
        return len(self.quotes)


def _dedupe_key(q: AirfareQuote) -> str:
    raw = "|".join(
        [
            q.route_id,
            q.airline,
            q.flight_number or "",
            q.travel_date,
            q.collection_date,
            q.advance_window,
            q.fare_class,
        ]
    )
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


def _validate_observation(q: AirfareQuote) -> None:
    """Schema-level content checks (spec §Part 4: invalid currency / dates /
    malformed values). Offending rows are marked, never dropped."""
    if q.status != QuoteStatus.VALID:
        return

    if q.currency not in SUPPORTED_CURRENCIES:
        q.status = QuoteStatus.MISSING
        q.quality_flags.append(f"unsupported_currency_{q.currency.lower()}")
        return

    try:
        travel = date.fromisoformat(q.travel_date)
    except (ValueError, TypeError):
        q.status = QuoteStatus.MISSING
        q.quality_flags.append("invalid_travel_date")
        return
    if travel <= q.collected_at.date():
        q.status = QuoteStatus.MISSING
        q.quality_flags.append("travel_date_not_after_collection")
        return

    if q.total_fare is not None and q.total_fare < 0:
        q.status = QuoteStatus.MISSING
        q.quality_flags.append("negative_total_fare")


def _apply_missing_rules(q: AirfareQuote) -> None:
    """Assign a status when the fare is unusable. Documented rule (PRD §7 FR-06)."""
    if q.total_fare is not None and q.total_fare > 0:
        return
    ps = (q.provider_status or "").lower()
    if ps == "sold_out" or (not q.availability and ps != "cancelled"):
        q.status = QuoteStatus.SOLD_OUT
        q.quality_flags.append("no_fare_sold_out")
    elif ps == "cancelled":
        q.status = QuoteStatus.CANCELLED
        q.quality_flags.append("no_fare_cancelled")
    else:
        q.status = QuoteStatus.MISSING
        q.quality_flags.append("missing_total_fare")


def clean(
    raws: list[RawQuote],
    *,
    outlier_threshold: float = DEFAULT_THRESHOLD,
    outlier_method: str = "mad",
) -> CleaningResult:
    # Stage 1–2: schema already enforced by RawQuote; normalize types.
    quotes = [normalize(r) for r in raws]

    # Stage 2b: content validation (currency / dates / malformed values).
    for q in quotes:
        _validate_observation(q)

    # Stage 3: duplicate detection (first occurrence kept).
    seen: set[str] = set()
    for q in quotes:
        key = _dedupe_key(q)
        q.dedupe_key = key
        if key in seen:
            q.status = QuoteStatus.DUPLICATE
            q.quality_flags.append("duplicate")
        else:
            seen.add(key)

    # Stage 4: missing-value rules (only rows still considered valid).
    for q in quotes:
        if q.status != QuoteStatus.VALID:
            continue
        _apply_missing_rules(q)

    # Stage 5: outlier flagging on robust per-(route, window) fare distributions.
    if outlier_method == "iqr":
        flagger = flag_outliers_iqr
    else:
        def flagger(vals: list[float]) -> list[bool]:
            return flag_outliers(vals, outlier_threshold)

    groups: dict[tuple[str, str], list[int]] = defaultdict(list)
    for idx, q in enumerate(quotes):
        if q.status == QuoteStatus.VALID and q.total_fare:
            groups[(q.route_id, q.advance_window)].append(idx)
    for members in groups.values():
        values = [quotes[i].total_fare or 0.0 for i in members]
        for member_idx, is_out in zip(members, flagger(values)):
            if is_out:
                quotes[member_idx].status = QuoteStatus.OUTLIER
                quotes[member_idx].quality_flags.append("price_outlier")

    # Stage 6: fare-component normalization for the rows we will use.
    for q in quotes:
        if q.status != QuoteStatus.VALID or not q.total_fare:
            continue
        if q.base_fare is None:
            q.base_fare = round(q.total_fare * 0.83, 2)
            q.taxes = round(q.total_fare - q.base_fare - (q.fees or 0.0), 2)
            q.quality_flags.append("fare_components_estimated")

    counts: dict[str, int] = {s.value: 0 for s in QuoteStatus}
    for q in quotes:
        counts[q.status.value] += 1
    counts["total"] = len(quotes)

    return CleaningResult(quotes=quotes, counts=counts)
