"""Common collector interface.

Every data source implements the same small contract so that new authorized
sources can be added without touching the cleaning pipeline or index engine
(PRD §14, NFR "adapter/collector interface").
"""

from __future__ import annotations

import abc
from dataclasses import dataclass
from datetime import date

from app.models.airfare import RawQuote


class CollectorError(RuntimeError):
    """Raised when a source fails; callers log it and continue with other sources."""


@dataclass(frozen=True)
class SearchRequest:
    route_id: str
    origin: str
    destination: str
    travel_date: date
    cabin: str = "ECONOMY"
    adults: int = 1


class FlightDataCollector(abc.ABC):
    """Base class for all flight-data sources."""

    #: short stable identifier stored on every quote (`source` field)
    name: str = "base"
    #: whether observations from this source are clearly-labelled synthetic data
    is_synthetic: bool = False

    @abc.abstractmethod
    async def search_flights(self, request: SearchRequest) -> list[dict]:
        """Return raw provider payloads (one dict per flight offer)."""

    @abc.abstractmethod
    def normalize_result(self, raw: dict, request: SearchRequest) -> RawQuote | None:
        """Map one raw provider payload to a RawQuote, or None to skip it."""

    async def collect(self, request: SearchRequest) -> list[RawQuote]:
        """Search + normalize in one call. Never raises for a single bad offer."""
        offers = await self.search_flights(request)
        quotes: list[RawQuote] = []
        for offer in offers:
            try:
                quote = self.normalize_result(offer, request)
            except Exception:  # noqa: BLE001 - one bad offer must not abort the run
                continue
            if quote is not None:
                quotes.append(quote)
        return quotes

    async def aclose(self) -> None:  # pragma: no cover - optional cleanup hook
        return None
