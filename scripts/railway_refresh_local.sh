#!/usr/bin/env bash
# Run FDIC refresh locally with Railway env vars (NOT inside the deployed container).
#
# DATABASE_URL often uses postgres.railway.internal — unreachable from your Mac unless
# DATABASE_PUBLIC_URL is set on the backend. Prefer in-container refresh:
#   railway ssh --service <backend> -- python railway_data_ingestion.py
#
# Usage from repo root:
#   ./scripts/railway_refresh_local.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "No python3 or python on PATH. Install Python 3 or use: railway ssh ... (see docs/RAILWAY_DATA_REFRESH.md)" >&2
  exit 127
fi
exec railway run "$PY" backend/railway_data_ingestion.py
