"""Robust outlier detection (PRD §15, §20, §28).

Uses the median and the Median Absolute Deviation (MAD) rather than mean/std so a
few extreme fares do not mask the rest. Extreme observations are *flagged*, never
deleted.
"""

from __future__ import annotations

from statistics import median

# 0.6745 = 75th percentile of the standard normal; scales MAD to be comparable
# to a standard deviation for normally-distributed data.
_MAD_SCALE = 0.6745
DEFAULT_THRESHOLD = 3.5


def modified_z_scores(values: list[float]) -> list[float]:
    """Return the modified z-score of each value. Empty/degenerate input -> zeros."""
    n = len(values)
    if n < 4:
        return [0.0] * n
    med = median(values)
    abs_dev = [abs(v - med) for v in values]
    mad = median(abs_dev)
    if mad == 0:
        # fall back to mean absolute deviation to still catch gross outliers
        mean_ad = sum(abs_dev) / n
        if mean_ad == 0:
            return [0.0] * n
        return [(v - med) / (1.253314 * mean_ad) for v in values]
    return [_MAD_SCALE * (v - med) / mad for v in values]


def flag_outliers(
    values: list[float], threshold: float = DEFAULT_THRESHOLD
) -> list[bool]:
    """True where |modified z-score| exceeds the threshold."""
    return [abs(z) > threshold for z in modified_z_scores(values)]


def normal_range(
    values: list[float], threshold: float = DEFAULT_THRESHOLD
) -> tuple[float, float] | None:
    """The fare band considered normal, for display ('₹4,000–₹7,000')."""
    if len(values) < 4:
        return None
    med = median(values)
    mad = median([abs(v - med) for v in values])
    if mad == 0:
        return None
    spread = threshold * mad / _MAD_SCALE
    return (max(med - spread, 0.0), med + spread)
