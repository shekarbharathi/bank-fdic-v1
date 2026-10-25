#!/bin/sh
# Run inside the deployed backend container (e.g. railway ssh).
# Usage:
#   railway ssh -- sh /app/run_railway_refresh.sh
# When Root Directory is `backend`, script lives at /app/run_railway_refresh.sh
cd "$(dirname "$0")"
exec python railway_data_ingestion.py
