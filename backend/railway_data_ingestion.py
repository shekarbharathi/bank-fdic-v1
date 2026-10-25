"""
Railway one-off job: refresh FDIC data with fixed retention (storage-neutral).

Usage:
  # Local machine (Railway env vars); use python3 on macOS — NOT `python` unless installed:
  railway run python3 railway_data_ingestion.py

  # Inside deployed container (recommended):
  railway ssh -- python railway_data_ingestion.py

Recommended env on the backend service:
  FDIC_API_KEY=...
  FDIC_MAX_LOOKBACK_YEARS=5          # keep ~20 quarters; delete older before load
  FDIC_PRUNE_ON_INGEST=true          # default
  FDIC_INGEST_MIN_REPDTE=2026-01-01  # optional: fetch only recent quarters (faster)

If Postgres is near capacity and you do not use financials_kv for queries:
  FDIC_DROP_FINANCIALS_KV=true       # drops the long-form table to reclaim space
"""
from fdic_optimized_ingestion import main

if __name__ == "__main__":
    main()
