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

Run the API (http://localhost:8000, docs at `/docs`):

```bash
uvicorn app.main:app --reload
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                  # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:8000`, so no CORS setup is
needed for local development.

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

**The Amadeus client secret must only ever live in `backend/.env`** — never in the
frontend, never committed to git. `.env` is gitignored; `.env.example` holds
placeholders only.

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
pytest                       # unit + API tests (uses an in-memory Mongo, no services needed)
```

---

## Deployment

| Component | Platform      | Notes                                                             |
| --------- | ------------- | ---------------------------------------------------------------- |
| Frontend  | Vercel        | Root `frontend/`, build `npm run build`, output `dist`. Set `VITE_API_BASE_URL` to the Render URL + `/api`. |
| Backend   | Render        | Root `backend/`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set all `backend/.env` vars, and `CORS_ORIGINS` to the Vercel URL. |
| Database  | MongoDB Atlas | Allow the Render egress IPs (or `0.0.0.0/0` for the prototype).  |

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
- Outliers are **flagged, never deleted** (robust median / MAD).
- Missing route observations follow a documented missing-data rule.

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
| C          | Full REST API + Methodology page                           | ⏳    |
| D          | Dashboard, Route, Lead-time, Data Quality, Airfare Data UI | ⏳    |
| E          | 30-day back-test, Reports/CSV, tests, deployment            | ⏳    |
