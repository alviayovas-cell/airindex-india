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

from app.models.airfare import AirfareQuote, QuoteStatus, RawQuote
from app.processors.normalizer import normalize
from app.processors.outlier import DEFAULT_THRESHOLD, flag_outliers


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


def clean(raws: list[RawQuote], *, outlier_threshold: float = DEFAULT_THRESHOLD) -> CleaningResult:
    # Stage 1–2: schema already enforced by RawQuote; normalize types.
    quotes = [normalize(r) for r in raws]

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

    # Stage 4: missing-value rules (skip rows already marked duplicate).
    for q in quotes:
        if q.status == QuoteStatus.DUPLICATE:
            continue
        _apply_missing_rules(q)

    # Stage 5: outlier flagging on robust per-(route, window) fare distributions.
    groups: dict[tuple[str, str], list[int]] = defaultdict(list)
    for idx, q in enumerate(quotes):
        if q.status == QuoteStatus.VALID and q.total_fare:
            groups[(q.route_id, q.advance_window)].append(idx)
    for members in groups.values():
        values = [quotes[i].total_fare or 0.0 for i in members]
        for member_idx, is_out in zip(members, flag_outliers(values, outlier_threshold)):
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
