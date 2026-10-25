# Railway data refresh (latest quarter, flat storage)

## Goal

Pull the **latest FDIC quarters** into the optimized `financials` table (35 fields, including deposit breakdown) **without growing** Postgres disk usage. Data is capped to a rolling window; older quarters are **deleted before** each refresh.

## Why storage was growing

- **`financials_kv`** (full FDIC field model) is very large if you ran `fdic_full_ingestion.py`. The app’s main UI and optimized schema use **`financials`**, not KV.
- **`fdic_optimized_ingestion.py`** upserts new quarters but, until pruning was added, **did not remove** quarters that fell outside the lookback window.

## Recommended refresh (Railway CLI)

1. In Railway → **backend** service → **Variables**, set:

   | Variable | Value | Notes |
   |----------|--------|--------|
   | `FDIC_API_KEY` | your key | Optional but avoids rate limits |
   | `FDIC_MAX_LOOKBACK_YEARS` | `5` | Same window for **fetch** and **retention** (~20 quarters) |
   | `FDIC_PRUNE_ON_INGEST` | `true` | Default; deletes `repdte` older than lookback **before** load |
   | `FDIC_INGEST_MIN_REPDTE` | `2026-01-01` | Optional; only hit the API for 2026+ (faster refresh) |

2. If disk is **>80%** and you do **not** rely on LLM queries against `financials_kv`:

   | Variable | Value |
   |----------|--------|
   | `FDIC_DROP_FINANCIALS_KV` | `true` |

   This drops `financials_kv` and frees the most space. Curated queries and the column picker use **`financials`**.

3. To **shrink history one time** (free more space, keep 4 years instead of 5):

   - Set `FDIC_MAX_LOOKBACK_YEARS=4`, run refresh once, then set back to `5` if desired.

4. Run the refresh using **one** of the methods below.

### Important: `railway run` is local, not remote

`railway run` executes on **your laptop** with Railway env vars (e.g. `DATABASE_URL`). It does **not** open the deployed container. On macOS, `python` is often missing (only `python3`), which causes:

`No such file or directory (os error 2)`

#### Option A — Run inside the deployed container (**recommended**)

`DATABASE_URL` on Railway often uses **`postgres.railway.internal`**. That hostname only works **inside** Railway’s network, not from your Mac. Running locally with `railway run` will fail with “could not translate host name postgres.railway.internal” unless you also configure a public DB URL (Option B).

```bash
# Backend service Root Directory = `backend`
railway ssh --service <your-backend-service-name> -- python railway_data_ingestion.py

# Monorepo root + Dockerfile.backend
railway ssh --service <your-backend-service-name> -- sh -c 'cd backend && python railway_data_ingestion.py'
```

#### Option B — Local refresh (only if `DATABASE_PUBLIC_URL` is set)

1. Railway → **Postgres** → enable **Public networking** / TCP proxy (if not already).
2. Copy the **public** connection URL into the **backend** service as `DATABASE_PUBLIC_URL` (reference from Postgres variables, or paste the proxy URL).
3. From repo root:

```bash
railway run python3 backend/railway_data_ingestion.py
```

Install deps once locally if imports fail: `pip install -r requirements.txt`

The refresh script auto-uses `DATABASE_PUBLIC_URL` when `DATABASE_URL` is a `.railway.internal` host and you are not on Railway.

#### Option C — HTTP (no CLI)

```bash
curl -X POST "https://YOUR-BACKEND.up.railway.app/api/data/ingest"
```

May timeout on large databases; Option A is safer for long jobs.

5. Confirm in logs:

   - `financials before: ... max_repdte=...`
   - `Prune result: { financials_deleted: ..., ... }`
   - `financials after: ... max_repdte=...` (should show the newest FDIC quarter, e.g. 2026-06-30 or 2026-09-30 when published)

6. In Railway Postgres metrics, disk may **not drop immediately** after `DELETE`; space is reused for new rows. A large drop (especially `FDIC_DROP_FINANCIALS_KV`) plus `VACUUM ANALYZE` (on by default via `FDIC_VACUUM_AFTER_PRUNE`) helps Postgres reclaim pages internally.

## HTTP trigger (may timeout on large DB)

```bash
curl -X POST "https://YOUR-BACKEND.up.railway.app/api/data/ingest"
```

Prefer `railway run` for long jobs.

## Verify in SQL

```sql
SELECT MIN(repdte) AS oldest, MAX(repdte) AS newest, COUNT(*) AS rows FROM financials;
SELECT pg_size_pretty(pg_total_relation_size('financials')) AS financials_size;
SELECT pg_size_pretty(pg_total_relation_size('financials_kv')) AS kv_size;  -- if table exists
```

## Env reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `FDIC_MAX_LOOKBACK_YEARS` | `5` | Retention + API lower bound |
| `FDIC_PRUNE_ON_INGEST` | `true` | Delete older quarters before ingest |
| `FDIC_PRUNE_FINANCIALS_KV` | `true` | Trim KV to same window (if table exists) |
| `FDIC_DROP_FINANCIALS_KV` | `false` | Drop entire KV table (max space savings) |
| `FDIC_INGEST_MIN_REPDTE` | (none) | Narrow API fetch to recent dates only |
| `FDIC_VACUUM_AFTER_PRUNE` | `true` | Run `VACUUM ANALYZE` after prune |
