"""Tiny in-process token-bucket rate limiter (spec §Part 20).

Good enough for a single-instance prototype: protects the expensive endpoints
(AI, manual collection) from accidental hammering. A real deployment would use a
shared store (Redis) keyed per client.
"""

from __future__ import annotations

import time


class TokenBucket:
    def __init__(self, per_minute: int) -> None:
        self.capacity = float(per_minute)
        self.tokens = float(per_minute)
        self.fill_per_sec = per_minute / 60.0
        self._updated = time.monotonic()

    def allow(self) -> bool:
        now = time.monotonic()
        self.tokens = min(
            self.capacity, self.tokens + (now - self._updated) * self.fill_per_sec
        )
        self._updated = now
        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False
