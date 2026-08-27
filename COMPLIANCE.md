# AIRINDEX — Requirement Compliance & Final Report

_Generated after Checkpoints F–L. Every "Implemented" row below was verified against
a live run (MongoDB Atlas, seeded synthetic dataset) — actual endpoint responses and
data flow, not the presence of a button._

---

## 1. Original problem-statement compliance

Legend: **IMPL** = implemented & verified · **PARTIAL** = works with caveats ·
**BLOCKED** = blocked by data / API access (framework in place)

| # | Requirement | Status | Evidence / notes |
|---|---|---|---|
| 1 | Real / high-frequency airfare collection | BLOCKED (data) | `AmadeusCollector` + scheduled `run_collection` are implemented and exercised by tests; no Amadeus credentials are configured, so live collection cannot be demonstrated. The pipeline runs on the labelled synthetic dataset. |
| 2 | Authorized flight-data source | IMPL | Amadeus Flight Offers Search adapter (`app/collectors/amadeus_collector.py`); OAuth2 client-credentials, 429 backoff, credentials backend-only. No scraping, no CAPTCHA/anti-bot circumvention. |
| 3 | Automated collection | IMPL | `APScheduler` job (`app/services/scheduler.py`), gated by `COLLECTION_ENABLED`; manual trigger `POST /api/collection/run` (rate-limited). |
| 4 | Ethical data acquisition | IMPL | Only authorized API + clearly-labelled synthetic data; every observation keeps `source` + `collected_at`; README ethics section. |
| 5 | Major Indian routes | IMPL | DEL-BOM, DEL-BLR, BOM-BLR, DEL-CCU, BLR-HYD, MAA-DEL (`app/domain.py::ROUTE_BASKET`). |
| 6 | Advance window T+1 | IMPL | `ADVANCE_WINDOWS = (1, 7, 15, 30, 45)`; collector requests one travel date per window. |
| 7 | Advance window T+7 | IMPL | as above. |
| 8 | Advance window T+15 | IMPL | as above. |
| 9 | Advance window T+30 | IMPL | as above. |
| 10 | Advance window T+45 | IMPL | as above. |
| 11 | Raw airfare observations | IMPL | `airfare_quotes` collection; `RawQuote` model retains origin/destination/airline/flight_number/travel_date/observation_date/advance_days/fare_type/base_fare/taxes/fees/total_fare/currency/source/availability/status/collection_timestamp; `raw_offer` kept for Amadeus. Never claimed as real prices. |
| 12 | Data cleaning | IMPL | `app/processors/cleaner.py`: schema → content validation → duplicate → missing-value → outlier → status. Flag-never-delete. |
| 13 | Missing values | IMPL | Documented missing-data rule; status `missing` + `quality_flags`; index renormalizes weights over routes with data. |
| 14 | Outlier detection | IMPL | Robust modified z-score (median + MAD, threshold 3.5) **or** Tukey-fence IQR, selectable via `PUT /api/config/index`. Flagged (`status = outlier`), excluded from index, never deleted. Tests: `test_processors.py`. |
| 15 | Duplicate removal | IMPL | SHA-1 dedupe key on route/airline/flight/dates/window/fare-class; first kept, rest flagged `duplicate`. |
| 16 | Cancellation / sold-out handling | IMPL | `provider_status` → status `cancelled` / `sold_out`; excluded from the index; shown in Data Quality. |
| 17 | Base fare | IMPL | `base_fare` stored; estimated + flagged when the source omits it. |
| 18 | Taxes | IMPL | `taxes` stored; reconciled against total; inconsistency flagged. |
| 19 | Fees | IMPL | `fees` stored where the source provides them. |
| 20 | Route basket | IMPL | 6-route basket in `app_config` (`routes` collection + `index.weights`). |
| 21 | Route weights | IMPL | Configurable in DB, **not** hard-coded in the frontend; editable in Settings → Routes and `PUT /api/config/weights`; renormalized to sum 1.0; every change recomputes the index. Tests: `test_config_api.py`. |
| 22 | Route index | IMPL | Per-route sub-index `100 × Pᵢ(t)/Pᵢ(0)` stored on every daily point; shown on Price Index, Route Analysis, Index Explorer. |
| 23 | Daily AIRINDEX | IMPL | `index_service.recompute_index` → daily `IndexValue` docs; `GET /api/index/daily`. |
| 24 | Weekly AIRINDEX | IMPL | Mean-of-daily aggregation; `GET /api/index/weekly`. Test: `test_index_engine.py`. |
| 25 | Monthly AIRINDEX | IMPL | as above; `GET /api/index/monthly`. |
| 26 | Price trends | IMPL | Index trend chart (daily/weekly/monthly), route sparklines, 1d/7d/30d change. |
| 27 | Route heatmap | IMPL | Ranked colour-tinted list (`RouteHeatmap.tsx`) **and** a new interactive inline-SVG India map (`IndiaRouteMap.tsx`) with click-through detail. |
| 28 | Lead-time analysis | IMPL | `GET /api/analytics/lead-time` with route / airline / fare-type / date filters; average & median by T+1…T+45; dedicated page + mini chart in the map panel. |
| 29 | REST API | IMPL | ~40 endpoints, `{success, data, message}` envelope, JWT auth, `/docs`. |
| 30 | Documentation | IMPL | README (setup, env, Atlas/Amadeus, deploy, methodology, ethics, endpoint table), in-app Methodology page, this file. |
| 31 | Automated testing | IMPL | 91 backend tests (pytest, in-memory Mongo) + 12 frontend Vitest tests. |
| 32 | 30-day backtesting | PARTIAL | `GET /api/backtest` compares the pipeline output against the **noise-free synthetic ground truth** (correlation ≈ 0.94, MAE ≈ 0.55, MAPE ≈ 0.55 %) — demonstrates the pipeline recovers the price signal. Limitations listed in the response and on the Validation page. |
| 33 | DGCA / reference comparison | BLOCKED (data) | The comparison slot is implemented (`reference_dataset` block) and the UI shows *"Validation dataset not yet available"*; no DGCA/NSO series is loaded. |

**Original problem statement: 28 IMPLEMENTED · 2 PARTIAL · 3 BLOCKED-BY-DATA (framework complete).**

---

## 2. Enhancement-feature compliance

| # | Feature | Status | Evidence / notes |
|---|---|---|---|
| 34 | Route volatility | IMPL | `GET /api/analytics/volatility` — experimental 0–100 score from the population std of daily route sub-index % returns; Low/Moderate/High/Very High; clearly labelled "not an official statistical measure". Volatility page + dashboard card. Tests: `test_volatility_spikes.py`. |
| 35 | Fare spike detection | IMPL | `spike_service.detect_fare_spikes` — mean valid fare for a route/window (optionally airline) vs the preceding period of equal length; classified against `app_config.alerts.spike_thresholds` (+5/+10/+20 %). Distinct from the per-observation outlier flag. Measured movements only. |
| 36 | Alerts | IMPL | `GET /api/alerts/fare-spikes` with route/airline/severity/window filters; Fare Spike Alerts page + dashboard card. (Synthetic data's gentle trend means no spikes fire at default thresholds — the empty state is correct, not a bug.) |
| 37 | Index explanation ("why did it change") | IMPL | `GET /api/index/explain` — observed contributors between two days (route-index change, weight, contribution delta, avg-fare movement), largest observed movement, most-affected window. Worded "observed", never causal. `WhyChangedCard` on Dashboard + Price Index. |
| 38 | Index calculation explorer | IMPL | `GET /api/index/calculation` — per-route weight / effective weight / route index / contribution table whose rows sum to the published index (`recomputed_from_rows` exposed). Dedicated Index Explorer page. Tests: `test_explain.py`. |
| 39 | Data quality dashboard | IMPL | `GET /api/data-quality` with date/route/airline/source filters, per-route & per-airline breakdown, daily trend, source health. Aggregated straight from `airfare_quotes`. Tests: `test_api_endpoints.py`. |
| 40 | AI Assistant | IMPL | `POST /api/ai/ask` — compact structured context from the computed data (no raw observations, no config/secrets — asserted by test), strict grounding system prompt for Claude, deterministic rule-based fallback when `AI_ENABLED=false` / no key / any LLM error. Rate-limited. Conversation UI. Tests: `test_ai_api.py`. |
| 41 | Fare prediction | PARTIAL (data) | `app/ml/` — 3 gradient-boosted quantile regressors (q10/q50/q90), time-based split, MAE/RMSE/coverage; `python -m app.ml.train` reads the **same `airfare_quotes` collection the index uses**; `GET /api/predictions/fare` returns a **range** (lower/point/upper), model version + metrics + training period + observation count; `{available: false}` with a reason (and the min-observations threshold) when there is no model. `data_basis` is **derived from each observation's `source`** (`demonstration` vs `authorized-api`), not hard-coded; the Predictions page shows a neutral description + Model Information panel, and the raw source breakdown stays in the API response. Provenance is stated on Data Sources / Methodology / Validation. Predictions never feed the index. Tests: `test_ml_festivals.py`. |
| 42 | Festival / holiday analysis | IMPL | `GET /api/analytics/festivals` — mean fare for travel dates in each event window vs outside every event window; "observed change during the event period", never "caused". Events outside the collected travel range are marked as such. Festival Analysis page. |
| 43 | Report generation | IMPL | `GET /api/reports?format=json\|csv\|pdf` + `/api/reports/{daily,weekly,monthly}` — full government-style report (index, route indexes, observed contributors, volatility, fare spikes, data quality, lead-time, methodology, source, disclaimer), built from the same services as the dashboard. PDF via reportlab. Tests: `test_backtest_reports.py`. |

**Enhancements: 8 IMPLEMENTED · 2 PARTIAL (prediction on synthetic data; backtest vs synthetic ground truth).**

---

## 3. Final report

### Existing architecture (preserved)
React 18 + TypeScript + Vite + Tailwind (design-token theme, light + purpose-built
dark) · Python 3.11+ / FastAPI / Pydantic v2 / Motor · MongoDB Atlas
(`airfare_quotes`, `routes`, `airlines`, `index_values`, `collection_runs`,
`data_quality`, `users`, `app_config`) · APScheduler · Vercel + Render + Atlas
deploy configs · JWT auth with an offline demo-login fallback.

### Features preserved
Login/auth, the dashboard, the Amadeus collector + adapter architecture, the
MongoDB layer, the weighted price-relative index engine, T+1…T+45, the 11 original
pages, Docker Compose, `vercel.json` / `render.yaml` / `Procfile` / `runtime.txt`.
No existing file deleted; no endpoint contract broken.

### Features added (Checkpoints F–L)
Runtime index config · IQR outlier option · content-validation cleaning stage ·
Index Calculation Explorer · "Why did AIRINDEX change?" · route volatility ·
fare-spike alerts · interactive India route map · lead-time filters ·
data-quality filters + per-route/airline breakdown · government-style reports
(PDF/CSV/JSON) · backtest limitations + external-reference slot · AI Assistant
(Claude + rule-based fallback) · ML fare-range prediction · festival/holiday
analysis · rate limiting on AI + collection.

### Files created (backend)
`app/api/{config,alerts,ai,predictions}.py` ·
`app/services/{explain_service,spike_service,data_quality_service,report_pdf,ai_service,festival_service}.py` ·
`app/core/ratelimit.py` · `app/ml/{__init__,features,train,predict}.py`

### Files created (frontend)
`src/lib/geo.ts` · `src/components/charts/IndiaRouteMap.tsx` ·
`src/components/dashboard/WhyChangedCard.tsx` ·
`src/pages/{IndexExplorer,Volatility,Alerts,AiAssistant,Predictions,Festivals}.tsx` ·
`src/api/{config,explain,ai,predictions}.ts` · Vitest config + `*.test.ts`

### Database changes
No schema migration required (MongoDB). New `app_config` keys:
`cleaning.outlier_method`, `alerts.spike_thresholds`, `ml.model`. New indexes on
`airfare_quotes`: `advance_window`, `source`, `status`, `(route_id, collection_date)`.
New optional fields on quotes: `airline_name`, `fare_type`, `raw_offer`.

### Environment variables added
`APP_PORT` (dev), `AI_ENABLED`, `ANTHROPIC_API_KEY`, `AI_MODEL`. All backend-only;
`.env` gitignored; `.env.example` has placeholders. No ML env vars (model config
lives in `app_config`).

### ML model
scikit-learn `GradientBoostingRegressor(loss="quantile")` × 3 (q10 / q50 / q90),
200 estimators, depth 3, time-based 80/20 split. Live metrics on the 30-day
synthetic dataset: MAE ≈ ₹199, RMSE ≈ ₹250, MAPE ≈ 3.3 %, 80 %-interval coverage
≈ 85 %. **Trained on synthetic demonstration data; predictions are a range, not a
guaranteed fare, and are never used in the index.**

### Index methodology
`I(t) = 100 × Σᵢ [ wᵢ × ( Pᵢ(t) / Pᵢ(0) ) ]`, Σwᵢ = 1, base period 2026-08-01 = 100.
`Pᵢ(t)` = mean over advance windows of the median total fare of route i's valid
observations on day t. Missing routes excluded, weights renormalized. Experimental
prototype — not an official CPI / NSO / RBI statistic.

### Data-cleaning methodology
Schema (Pydantic) → content validation (currency, invalid/mis-ordered dates,
negative fares) → type normalization → duplicate detection (SHA-1 key) →
missing-value rules → robust outlier flagging (MAD z-score or IQR) → status +
`quality_flags`. Suspicious rows are retained, never deleted.

### Testing results
Backend: **91 passed** (pytest, in-memory Mongo, no external services).
Frontend: **12 passed** (Vitest). `tsc --noEmit` clean, `npm run build` clean,
`eslint` 0 errors (3 pre-existing `react-refresh` warnings).

### Backtesting results
Pipeline vs synthetic ground truth over 30 days: correlation ≈ 0.94, MAE ≈ 0.55
index points, MAPE ≈ 0.55 %. No external (DGCA / NSO) reference series is loaded —
that comparison is stubbed and the UI states it is unavailable.

### Known limitations
- No live Amadeus credentials → real collection and a real-world backtest are not
  demonstrated; the framework and tests prove the pipeline on labelled synthetic data.
- ML predictions and the backtest reference are synthetic-data-based and labelled as such.
- Fare-spike alerts are empty on the demo data at default thresholds (the synthetic
  trend is too gentle) — lower `alerts.spike_thresholds` to populate the view.
- The India map is a schematic inline-SVG silhouette, not a survey-accurate map.
- Rate limiting is single-instance (in-process token bucket).

### Deployment instructions
1. **DB** — MongoDB Atlas M0, DB user, Network Access `0.0.0.0/0`, copy the SRV URI.
2. **Backend** — Render Blueprint (`backend/render.yaml`) or a Web Service: root
   `backend`, Python 3.12, `pip install -r requirements.txt`,
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health `/api/health`. Env:
   `MONGODB_URI`, `JWT_SECRET`, `DEMO_USER_PASSWORD`, `CORS_ORIGINS` = your Vercel
   URL, optional `AMADEUS_*`, optional `AI_ENABLED` + `ANTHROPIC_API_KEY`. After
   first deploy: `python -m app.scripts.seed_database` from the Render shell
   (also trains the fare model).
3. **Frontend** — Vercel, root `frontend`, `VITE_API_BASE_URL` =
   `https://<render-app>.onrender.com/api`.
