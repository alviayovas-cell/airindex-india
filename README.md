# AIRINDEX

**Real-time Airfare Price Intelligence for India** — internal hackathon prototype.

AIRINDEX collects permitted airfare observations from an authorized flight-data API
(Amadeus), normalizes and cleans them, stores them in MongoDB, computes a transparent
**experimental weighted Airfare Price Index (APIx)**, and serves the result through a
REST API and a modern analytics dashboard.

> ⚠️ **Experimental prototype.** This is not an official CPI methodology and not an
> NSO/RBI system. It never bypasses CAPTCHA, authentication, rate limits or other
> access controls — data comes only from authorized APIs or clearly labelled
> synthetic datasets.

---

## Architecture

```
Amadeus API ─► Collector adapters ─► Normalizer ─► Cleaner / quality flags
                                                        │
                                          MongoDB Atlas (airfare_quotes)
                                                        │
                                              Index engine (weighted)
                                                        │
                                        FastAPI  ◄────────────────►  React dashboard
```

| Layer     | Technology                                          |
| --------- | --------------------------------------------------- |
| Frontend  | React 18, TypeScript, Vite, Tailwind CSS, Recharts  |
| Data      | TanStack Query, Axios, Lucide icons                 |
| Backend   | Python 3.11+, FastAPI, Pydantic v2, Motor           |
| Database  | MongoDB Atlas (or local MongoDB)                    |
| Collect   | Amadeus Flight Offers Search API (OAuth2)           |
| Schedule  | APScheduler                                         |
| AI        | Anthropic Claude (optional) — rule-based fallback   |
| Deploy    | Vercel (frontend) · Render (backend) · Atlas (DB)   |

---

## Prerequisites

- **Node.js 20+** and npm
- **Python 3.11+**
- **A MongoDB connection string** — either:
  - a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (recommended for the demo), or
  - a local MongoDB (`docker compose up -d` if you have Docker), or
  - a local MongoDB Community Server install.
- *(Optional)* Amadeus for Developers credentials — the app runs fully on the
  synthetic seed dataset without them.

---

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate       macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # then edit .env  (see "Environment variables" below)
```

Seed the database — reference data + a labelled synthetic 30-day airfare dataset
run through the real cleaning pipeline, plus the computed index:

```bash
python -m app.scripts.seed_database          # 30 days (default)
python -m app.scripts.seed_database --days 45
python -m app.scripts.seed_database --reference-only   # no synthetic observations
python -m app.scripts.show_index             # print the computed index
```

Run the API (http://localhost:8010, docs at `/docs`):

```bash
python run_dev.py            # single process on port 8010
python run_dev.py --reload   # opt in to auto-reload
```

> On Windows, prefer `run_dev.py` over `uvicorn --reload`: the reloader can leave a
> child process holding the socket, causing `WinError 10013` on the next start. If
> it happens anyway: `Get-NetTCPConnection -LocalPort 8010 | Select OwningProcess`
> then `Stop-Process -Id <n> -Force`, or run `python run_dev.py --port 8020`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                  # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:8010` (override with
`VITE_API_PROXY`), so no CORS setup is needed for local development.

### 3. Sign in

```
Email:    analyst@airindex.dev
Password: airindex123
```

(Created by the seed script; override via `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`.)

---

## Environment variables

### `backend/.env`

| Variable                      | Purpose                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| `MONGODB_URI`                 | MongoDB connection string                                     |
| `DATABASE_NAME`               | Database name (default `airfare_index`)                       |
| `JWT_SECRET`                  | Secret for signing access tokens — change for any real deploy |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime                                                |
| `DEMO_USER_EMAIL` / `_PASSWORD` | Seeded demo login                                           |
| `AMADEUS_CLIENT_ID` / `_SECRET` | Amadeus OAuth2 credentials (optional)                       |
| `AMADEUS_BASE_URL`            | `https://test.api.amadeus.com` (test) or the production host  |
| `COLLECTION_INTERVAL_MINUTES` | Scheduled collection cadence                                  |
| `COLLECTION_ENABLED`          | `true` to start the APScheduler job on boot                   |
| `CORS_ORIGINS`                | Comma-separated allowed origins for the deployed frontend     |
| `AI_ENABLED`                  | `true` to route the AI assistant to Claude (else rule-based)  |
| `ANTHROPIC_API_KEY`           | Claude API key — backend-only, never in the frontend          |
| `AI_MODEL`                    | Claude model id (default `claude-sonnet-5`)                   |

**The Amadeus client secret and the Anthropic API key must only ever live in
`backend/.env`** — never in the frontend, never committed to git. `.env` is
gitignored; `.env.example` holds placeholders only.

### AI assistant

`POST /api/ai/ask` answers natural-language questions using only a compact
structured snapshot of the *computed* index (current index, route sub-indexes,
volatility, observed contributors, lead-time, data-quality headline) — never raw
observations, never configuration. With `AI_ENABLED=false` or a blank
`ANTHROPIC_API_KEY` it uses a built-in **rule-based engine** (current index / most
volatile route / route lookup / compare / best window / why-changed / data
quality); set the key to route through Claude with a strict grounding prompt.
Per-process rate limiting, an 18 s timeout, and graceful fallback to the
rule-based engine on any LLM error.

### `frontend/.env`

| Variable            | Purpose                                                    |
| ------------------- | --------------------------------------------------------- |
| `VITE_API_BASE_URL` | Backend API base URL. `/api` locally (uses the dev proxy) |

---

## MongoDB setup

**Atlas:** create a free M0 cluster → *Database Access* add a user → *Network Access*
allow your IP (or `0.0.0.0/0` for the hackathon) → *Connect → Drivers* copy the URI
into `MONGODB_URI`. The seed script creates all collections and indexes.

**Local (Docker):** `docker compose up -d` then set `MONGODB_URI=mongodb://localhost:27017`.

Collections: `airfare_quotes`, `routes`, `airlines`, `index_values`,
`collection_runs`, `data_quality`, `users`, `app_config`.

---

## Amadeus setup

1. Register at <https://developers.amadeus.com/> and create a **Self-Service** app.
2. Copy the API Key / API Secret into `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET`.
3. Keep `AMADEUS_BASE_URL=https://test.api.amadeus.com` for the free test environment.

If these are blank, AIRINDEX serves the labelled synthetic dataset and the Data
Sources page shows Amadeus as *Not configured*.

---

## Running tests

```bash
cd backend
pip install -r requirements-dev.txt   # adds pytest + in-memory Mongo
pytest                                # 75 tests — unit + API, no external services

cd ../frontend
npm test                              # 12 Vitest unit tests (projection, formatting, CSV)
```

Backend coverage: index formula (standalone), weights & missing-route
renormalization + runtime config, normalizer, cleaner (dedupe / missing / outlier
via MAD & IQR / currency & date guards), synthetic reproducibility, index
explorer + observed contributors, route volatility, fare-spike classification,
lead-time filters, every REST endpoint, and the back-test.

---

## API

All responses use the envelope `{ "success": bool, "data": <payload|null>, "message": str }`.
Every endpoint except `/api/health` and `/api/auth/login` requires
`Authorization: Bearer <token>`. Full interactive docs at `/docs`.

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/api/auth/login` | Obtain a JWT (`{email, password, remember_me}`) |
| GET | `/api/health` | Service + DB + Amadeus status |
| GET | `/api/overview` | Dashboard KPI bundle (index, counts, quality, last run) |
| GET | `/api/index/current` | Latest index, 1d/7d/30d change, 30-point sparkline |
| GET | `/api/index/history?frequency=` | Full series — `daily` \| `weekly` \| `monthly` |
| GET | `/api/index/{daily,weekly,monthly}` | Series shortcuts |
| GET | `/api/routes` | Route basket with per-route index, fare, change, sparkline |
| GET | `/api/routes/{route_id}` | One route: index history, lead-time curve, airline breakdown |
| GET | `/api/airlines` | Airlines with observation counts and average fare |
| GET | `/api/flights` | Observation explorer — filter / sort / paginate + filter options |
| GET | `/api/flights/search?route_id=&advance_days=` | Ad-hoc live lookup (not stored) |
| GET | `/api/analytics/lead-time?route=&airline=&fare_type=&date_from=&date_to=` | Avg / median / count by T+1…T+45, with filter options |
| GET | `/api/analytics/volatility?window_days=` | Per-route experimental volatility score (0–100) + category |
| GET | `/api/alerts/fare-spikes?window_days=&route_id=&airline=&severity=` | Fare increases vs the preceding period, classified against configurable thresholds |
| GET | `/api/analytics/routes` | Route heatmap (route-level % change) |
| GET | `/api/analytics/airlines` | Airline fare comparison |
| GET | `/api/data-quality?date_from=&date_to=&route_id=&airline=&source=` | Totals, per-day / per-route / per-airline breakdown, per-source health |
| GET | `/api/collection/status` | Last collection run |
| POST | `/api/collection/run?mode=auto\|amadeus\|synthetic` | Trigger a collection + reindex |
| GET | `/api/methodology` | Base period, basket, weights, formula, rules, disclaimer |
| GET | `/api/index/calculation?date=` | Per-route weight / route-index / contribution table (rows sum to the index) |
| GET | `/api/index/explain?date=&compare=` | Largest observed contributors to the index change between two days |
| GET | `/api/config` | Runtime index config: weights (raw + normalized), base period, outlier method |
| PUT | `/api/config/weights` | Update route-basket weights (renormalized) and recompute the index |
| PUT | `/api/config/index` | Update base period / methodology version / outlier method (`mad` \| `iqr`) |
| GET | `/api/backtest` | 30-day validation: our index vs reference, MAE/RMSE/correlation, limitations, external-reference status |
| GET | `/api/reports?date_from=&date_to=&route_id=&frequency=&format=` | Full government-style report; `format` = `json` \| `csv` \| `pdf` |
| GET | `/api/reports/{daily,weekly,monthly}?format=` | Report shortcuts |
| GET | `/api/ai/status` | Whether the AI assistant uses Claude or the rule-based engine |
| POST | `/api/ai/ask` | Natural-language Q&A over the computed index data (`{question, history?}`) |

---

## Deployment

```
User browser ─► Vercel (React) ─► Render (FastAPI) ─► MongoDB Atlas
                                       └─► Amadeus API
```

### 1. Database — MongoDB Atlas
Free M0 cluster, a DB user, and *Network Access* → `0.0.0.0/0` (Render's egress IPs
are dynamic on the free plan). Copy the SRV URI.

### 2. Backend — Render
`backend/render.yaml` is a Blueprint: **New + → Blueprint**, point at this repo.
Or create a **Web Service** manually:
- Root directory `backend`, runtime Python 3.12 (`runtime.txt`)
- Build `pip install -r requirements.txt` · Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check path `/api/health`
- Env vars: `MONGODB_URI`, `DATABASE_NAME`, `JWT_SECRET`, `DEMO_USER_PASSWORD`,
  `AMADEUS_CLIENT_ID/SECRET` (optional), and **`CORS_ORIGINS`** = your Vercel URL
  (e.g. `https://airindex.vercel.app`)

After first deploy, seed once from the Render Shell:
`python -m app.scripts.seed_database`

### 3. Frontend — Vercel
Import the repo, set **Root Directory** to `frontend` (`vercel.json` handles the
Vite build + SPA rewrites). Add one env var: `VITE_API_BASE_URL` =
`https://<your-render-app>.onrender.com/api`.

### Local demo fallback
If deployment is unavailable, the whole product runs locally from the seed data
with no Amadeus key and (via the offline-login fallback) even without MongoDB for
the login screen.

---

## Index methodology (summary)

Experimental weighted price-relative index with a fixed base period and route basket:

```
I(t) = 100 × Σ [ wᵢ × ( Pᵢ(t) / Pᵢ(0) ) ]     with  Σ wᵢ = 1
```

- **Base period:** `2026-08-01` (index = 100)
- **Route basket & weights** (editable in `app_config`):
  DEL-BOM 25% · DEL-BLR 20% · BOM-BLR 20% · DEL-CCU 15% · BLR-HYD 10% · MAA-DEL 10%
- **Advance windows:** T+1, T+7, T+15, T+30, T+45
- Outliers are **flagged, never deleted** — robust modified z-score (median / MAD) by
  default, or Tukey-fence IQR, selectable via `PUT /api/config/index`.
- Content validation flags unsupported currency, invalid/mis-ordered travel dates and
  negative fares (status set, row retained).
- Missing route observations follow a documented missing-data rule.
- Route-basket weights, base period and outlier method are runtime-editable (Settings →
  Index Configuration / Routes, or `PUT /api/config/*`); every change recomputes the index.

Full methodology is versioned and shown on the in-app **Methodology** page.

---

## Data-source limitations & ethics

- Only authorized APIs and permitted/synthetic data are used.
- No scraping of sources that prohibit automated collection; no CAPTCHA / anti-bot
  circumvention; conservative rate limiting and backoff.
- Synthetic demonstration data is always labelled as such and never presented as
  real airline prices.
- Every stored observation retains its `source` and `collected_at` timestamp.

---

## Build status

| Checkpoint | Scope                                                        | State |
| ---------- | ----------------------------------------------------------- | ----- |
| A          | Shell, design system, auth (JWT), MongoDB connection        | ✅    |
| B          | Amadeus adapter, normalization, cleaning, index engine, seed data | ✅ |
| C          | Full REST API (21 endpoints) wired to the index engine     | ✅    |
| D          | Dashboard, Price Index, Route, Lead-time, Data Quality, Airfare Data, Methodology, Data Sources UI | ✅ |
| E          | 30-day validation, Reports + CSV, APScheduler, Vercel/Render configs | ✅ |
| F          | Data-model & quality hardening, IQR outlier option, runtime index config (`/api/config`) | ✅ |
| G          | Index Calculation Explorer + "Why did AIRINDEX change?" observed contributors | ✅ |
| H          | Route price volatility + fare-spike detection & alerts | ✅ |
| I          | Interactive India route map + lead-time filters | ✅ |
| J          | Data-quality dashboard filters + government-style reports (PDF/JSON) + backtest limitations | ✅ |
| K          | AI Assistant (`/api/ai/ask`, Claude, structured-context retrieval) | ✅ |
| L          | ML fare prediction, festival analysis, security/testing/UX/docs pass | ⬜ |
