"""Amadeus Flight Offers Search adapter.

The backend performs the OAuth2 client-credentials exchange and all API calls;
credentials never leave the server. If credentials are not configured the
collector reports itself unavailable and the pipeline falls back to synthetic
data (PRD §12, §15).
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

import httpx

from app.collectors.base import CollectorError, FlightDataCollector, SearchRequest
from app.config import settings
from app.models.airfare import RawQuote

logger = logging.getLogger("airindex.collector.amadeus")

_TOKEN_URL = "/v1/security/oauth2/token"
_SEARCH_URL = "/v2/shopping/flight-offers"


class AmadeusCollector(FlightDataCollector):
    name = "amadeus"
    is_synthetic = False

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.amadeus_base_url, timeout=20.0
        )
        self._token: str | None = None
        self._token_expiry: float = 0.0
        self._lock = asyncio.Lock()

    @staticmethod
    def is_available() -> bool:
        return settings.amadeus_configured

    async def _access_token(self) -> str:
        async with self._lock:
            if self._token and time.monotonic() < self._token_expiry - 30:
                return self._token
            resp = await self._client.post(
                _TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.amadeus_client_id,
                    "client_secret": settings.amadeus_client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if resp.status_code != 200:
                raise CollectorError(
                    f"Amadeus auth failed ({resp.status_code})"
                )
            payload = resp.json()
            self._token = payload["access_token"]
            self._token_expiry = time.monotonic() + float(payload.get("expires_in", 1799))
            return self._token

    async def search_flights(self, request: SearchRequest) -> list[dict]:
        token = await self._access_token()
        params = {
            "originLocationCode": request.origin,
            "destinationLocationCode": request.destination,
            "departureDate": request.travel_date.isoformat(),
            "adults": request.adults,
            "currencyCode": "INR",
            "max": 15,
        }
        backoff = 1.0
        for attempt in range(4):
            resp = await self._client.get(
                _SEARCH_URL,
                params=params,
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 200:
                return resp.json().get("data", [])
            if resp.status_code == 429:  # rate limited — back off
                await asyncio.sleep(backoff)
                backoff *= 2
                continue
            if resp.status_code in (401, 403):
                self._token = None
                token = await self._access_token()
                continue
            raise CollectorError(
                f"Amadeus search failed ({resp.status_code}) for {request.route_id}"
            )
        raise CollectorError(f"Amadeus rate-limited for {request.route_id}")

    def normalize_result(self, raw: dict, request: SearchRequest) -> RawQuote | None:
        try:
            itineraries = raw.get("itineraries") or []
            segments = itineraries[0].get("segments") if itineraries else []
            if not segments:
                return None
            first_seg = segments[0]
            carrier = first_seg.get("carrierCode", "")
            flight_number = f"{carrier}{first_seg.get('number', '')}" or None

            price = raw.get("price") or {}
            total = _to_float(price.get("grandTotal") or price.get("total"))
            base = _to_float(price.get("base"))
            fees = sum(_to_float(f.get("amount")) or 0.0 for f in price.get("fees") or [])
            taxes = None
            if total is not None and base is not None:
                taxes = round(max(total - base - fees, 0.0), 2)

            cabin = "Economy"
            fare_class = "standard"
            tps = raw.get("travelerPricings") or []
            if tps:
                fd = (tps[0].get("fareDetailsBySegment") or [{}])[0]
                cabin = (fd.get("cabin") or "ECONOMY").title()
                fare_class = fd.get("brandedFare") or fd.get("class") or "standard"

            now = datetime.now(timezone.utc)
            advance_days = (request.travel_date - now.date()).days
            seats = int(raw.get("numberOfBookableSeats", 1))

            return RawQuote(
                route_id=request.route_id,
                origin=request.origin,
                destination=request.destination,
                airline=carrier or "Unknown",
                flight_number=flight_number,
                travel_date=request.travel_date.isoformat(),
                collected_at=now,
                advance_days=advance_days,
                cabin=cabin,
                fare_class=str(fare_class),
                base_fare=base,
                taxes=taxes,
                fees=round(fees, 2) if fees else 0.0,
                total_fare=total,
                currency=price.get("currency", "INR"),
                availability=seats > 0,
                source=self.name,
                provider_status="sold_out" if seats == 0 else "ok",
            )
        except (KeyError, IndexError, TypeError, ValueError):
            return None

    async def aclose(self) -> None:
        await self._client.aclose()


def _to_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
