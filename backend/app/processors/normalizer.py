"""Type normalization: raw quote -> canonical fields (PRD §15 stage 2)."""

from __future__ import annotations

from app.domain import advance_window_label
from app.models.airfare import AirfareQuote, QuoteStatus, RawQuote


def _round_money(value: float | None) -> float | None:
    return None if value is None else round(float(value), 2)


def normalize(raw: RawQuote) -> AirfareQuote:
    """Canonicalise casing, currency and fare components. No validity decisions here."""
    base = _round_money(raw.base_fare)
    taxes = _round_money(raw.taxes)
    fees = _round_money(raw.fees)
    total = _round_money(raw.total_fare)

    # Reconcile total vs components when exactly one side is known.
    if total is None and base is not None:
        total = _round_money(base + (taxes or 0.0) + (fees or 0.0))

    flags: list[str] = []
    if total is not None and base is not None:
        implied = base + (taxes or 0.0) + (fees or 0.0)
        if abs(implied - total) > max(1.0, 0.02 * total):
            flags.append("fare_components_inconsistent")
    if raw.total_fare is None and total is not None:
        flags.append("total_fare_derived")

    return AirfareQuote(
        route_id=raw.route_id.upper(),
        origin=raw.origin.upper(),
        destination=raw.destination.upper(),
        airline=raw.airline.upper(),
        flight_number=(raw.flight_number or None),
        travel_date=raw.travel_date,
        collected_at=raw.collected_at,
        advance_days=int(raw.advance_days),
        cabin=raw.cabin.title() if raw.cabin else "Economy",
        fare_class=(raw.fare_class or "standard").lower(),
        base_fare=base,
        taxes=taxes,
        fees=fees,
        total_fare=total,
        currency=(raw.currency or "INR").upper(),
        availability=bool(raw.availability),
        source=raw.source,
        provider_status=raw.provider_status,
        advance_window=advance_window_label(int(raw.advance_days)),
        collection_date=raw.collected_at.date().isoformat(),
        status=QuoteStatus.VALID,
        quality_flags=flags,
        is_synthetic=raw.source == "synthetic",
    )
