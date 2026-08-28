"""Filesystem paths + thresholds for the fare-prediction model.

Kept free of heavy imports (numpy / scikit-learn) so the web app boots even on a
trimmed deployment where those packages are not installed. Install them with
``pip install -r requirements-ml.txt`` to enable fare prediction.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "fare_model.pkl"
MIN_ROWS_DEFAULT = 400


def prediction_deps_installed() -> bool:
    """True when numpy + scikit-learn are importable (needed to train/score)."""
    try:
        return all(
            importlib.util.find_spec(m) is not None for m in ("numpy", "sklearn")
        )
    except (ImportError, ValueError):  # pragma: no cover
        return False
