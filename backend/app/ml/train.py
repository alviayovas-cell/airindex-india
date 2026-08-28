"""Train the fare-range prediction model (spec §Part 14).

    python -m app.ml.train                 # trains from the current database
    python -m app.ml.train --min-rows 500  # refuse to train on too little data

Three gradient-boosted quantile regressors (q10 / q50 / q90) predict a fare
*range*, never a guaranteed fare. A time-based split (earliest 80% train, latest
20% test) gives an honest estimate. The model, encoders and metrics are pickled
to ``app/ml/artifacts/`` and the version is recorded in ``app_config``.

The training data is the labelled synthetic demonstration dataset — predictions
are illustrative only and are NEVER fed back into the AIRINDEX calculation.
"""

from __future__ import annotations

import argparse
import asyncio
import pickle
import sys
from datetime import datetime, timezone

import numpy as np

from app.database.connection import Database
from app.database.repositories import AirfareQuoteRepository, ConfigRepository
from app.ml.paths import ARTIFACT_DIR, MIN_ROWS_DEFAULT, MODEL_PATH
from app.services.analytics_service import route_volatility

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def _split_by_time(dates: list[str], test_frac: float = 0.2) -> tuple[np.ndarray, np.ndarray]:
    order = np.argsort(dates, kind="stable")
    cut = int(len(order) * (1 - test_frac))
    return order[:cut], order[cut:]


async def train(min_rows: int = MIN_ROWS_DEFAULT, *, db=None) -> dict:
    from sklearn.ensemble import GradientBoostingRegressor

    from app.ml.features import FeatureSpec, build_matrix

    owns_connection = db is None
    if db is None:
        if not await Database.ping(force=True):
            raise SystemExit("Cannot reach MongoDB — check MONGODB_URI in backend/.env")
        db = Database.get_db()

    rows = await AirfareQuoteRepository(db).training_rows()
    if len(rows) < min_rows:
        ARTIFACT_DIR.mkdir(exist_ok=True)
        summary = {
            "available": False,
            "reason": (
                f"Only {len(rows)} valid observations; need >= {min_rows} to train a "
                "meaningful model. Collect more data first."
            ),
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }
        await ConfigRepository(db).set("ml.model", summary)
        if owns_connection:
            await Database.close()
        print(summary["reason"])
        return summary

    routes = sorted({r["route_id"] for r in rows})
    airlines = sorted({r["airline"] for r in rows})
    fare_types = sorted(
        {(r.get("fare_type") or r.get("fare_class") or "standard").lower() for r in rows}
    )
    route_hist_mean = {
        rid: float(np.mean([r["total_fare"] for r in rows if r["route_id"] == rid]))
        for rid in routes
    }
    vol = {v["route_id"]: v["volatility_score"] for v in (await route_volatility(db))["routes"]}
    collection_dates = [r["collection_date"] for r in rows if r.get("collection_date")]
    min_cd = min(collection_dates) if collection_dates else "9999-12-31"
    max_cd = max(collection_dates) if collection_dates else min_cd

    # Provenance of the training data, read from each observation's `source`.
    source_counts: dict[str, int] = {}
    for r in rows:
        source_counts[r.get("source", "unknown")] = (
            source_counts.get(r.get("source", "unknown"), 0) + 1
        )
    authorized = sum(n for s, n in source_counts.items() if s not in ("synthetic", "unknown"))
    data_basis = "authorized-api" if authorized > len(rows) / 2 else "demonstration"

    spec = FeatureSpec(
        routes=routes,
        airlines=airlines,
        fare_types=fare_types,
        route_hist_mean=route_hist_mean,
        route_volatility={r: float(vol.get(r, 0.0)) for r in routes},
        min_collection_date=min_cd,
    )

    X, y, dates = build_matrix(rows, spec)
    train_idx, test_idx = _split_by_time(dates)
    Xtr, ytr = X[train_idx], y[train_idx]
    Xte, yte = X[test_idx], y[test_idx]

    models = {}
    for tag, alpha in (("q10", 0.1), ("q50", 0.5), ("q90", 0.9)):
        m = GradientBoostingRegressor(
            loss="quantile",
            alpha=alpha,
            n_estimators=200,
            max_depth=3,
            learning_rate=0.05,
            subsample=0.9,
            random_state=42,
        )
        m.fit(Xtr, ytr)
        models[tag] = m

    lo = models["q10"].predict(Xte)
    mid = models["q50"].predict(Xte)
    hi = models["q90"].predict(Xte)
    resid = mid - yte
    coverage = float(np.mean((yte >= lo) & (yte <= hi)))
    metrics = {
        "mae": round(float(np.mean(np.abs(resid))), 1),
        "rmse": round(float(np.sqrt(np.mean(resid**2))), 1),
        "mape_pct": round(float(np.mean(np.abs(resid) / np.maximum(yte, 1)) * 100), 2),
        "interval_coverage_pct": round(coverage * 100, 1),
        "mean_interval_width": round(float(np.mean(hi - lo)), 0),
    }

    version = datetime.now(timezone.utc).strftime("fare-%Y%m%d-%H%M%S")
    artifact = {
        "version": version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "algorithm": "GradientBoostingRegressor (quantile) x3",
        "algorithm_label": "Gradient Boosting (quantile regression)",
        "quantiles": [0.1, 0.5, 0.9],
        "spec": spec,
        "models": models,
        "metrics": metrics,
        "n_train": int(len(train_idx)),
        "n_test": int(len(test_idx)),
        "n_observations": len(rows),
        "training_period": {"from": min_cd, "to": max_cd},
        "data_basis": data_basis,
        "data_sources": source_counts,
        "feature_names": spec.feature_names,
    }
    ARTIFACT_DIR.mkdir(exist_ok=True)
    with MODEL_PATH.open("wb") as f:
        pickle.dump(artifact, f)

    await ConfigRepository(db).set(
        "ml.model",
        {
            "available": True,
            "version": version,
            "trained_at": artifact["trained_at"],
            "metrics": metrics,
            "n_train": artifact["n_train"],
            "n_test": artifact["n_test"],
            "n_observations": len(rows),
            "training_period": artifact["training_period"],
            "data_basis": data_basis,
            "data_sources": source_counts,
        },
    )
    from app.ml.predict import reload_model

    reload_model()
    if owns_connection:
        await Database.close()

    print(f"  version  : {version}")
    print(f"  rows     : {len(rows)} ({artifact['n_train']} train / {artifact['n_test']} test)")
    print(f"  metrics  : {metrics}")
    print(f"  saved    : {MODEL_PATH}")
    return artifact


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the AIRINDEX fare-range model")
    parser.add_argument("--min-rows", type=int, default=MIN_ROWS_DEFAULT)
    args = parser.parse_args()
    asyncio.run(train(min_rows=args.min_rows))


if __name__ == "__main__":
    main()
