"""
Resolve Postgres URL for local CLI (railway run) vs in-container (Railway runtime).
"""
from __future__ import annotations

import os
from urllib.parse import urlparse


def _hostname(url: str) -> str:
    try:
        return urlparse(url.strip()).hostname or ""
    except Exception:
        return ""


def _running_on_railway() -> bool:
    return bool(os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RAILWAY_SERVICE_NAME"))


def resolve_database_url() -> str:
    """
    Pick a DSN that works in the current environment.

    Railway's DATABASE_URL often uses *.railway.internal (private network). That host
    does not resolve on a developer laptop; use DATABASE_PUBLIC_URL locally or run
    the job via `railway ssh`.
    """
    internal = os.getenv("DATABASE_URL", "").strip()
    public = (
        os.getenv("DATABASE_PUBLIC_URL", "").strip()
        or os.getenv("DATABASE_URL_PUBLIC", "").strip()
    )
    force_internal = os.getenv("FDIC_USE_INTERNAL_DATABASE_URL", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )

    if internal and not force_internal:
        host = _hostname(internal)
        if host.endswith(".railway.internal") and not _running_on_railway():
            if public:
                print(
                    "[info] Using DATABASE_PUBLIC_URL for off-platform run "
                    "(DATABASE_URL host is Railway private network)."
                )
                return public
            raise RuntimeError(
                "DATABASE_URL points at a Railway private host "
                f"({host!r}), which is not reachable from your laptop.\n\n"
                "Do one of the following:\n"
                "  1. Run inside the deployed backend (recommended):\n"
                "       railway ssh --service <backend> -- python railway_data_ingestion.py\n"
                "     (monorepo root image: railway ssh -- sh -c 'cd backend && python railway_data_ingestion.py')\n"
                "  2. Enable public TCP on Postgres in Railway, add DATABASE_PUBLIC_URL to the backend service,\n"
                "     then run: railway run python3 backend/railway_data_ingestion.py\n"
                "  3. POST https://<backend>/api/data/ingest\n"
            )
        return internal

    if public:
        return public

    return (
        f"dbname={os.getenv('DB_NAME', 'fdic')} "
        f"user={os.getenv('DB_USER', 'postgres')} "
        f"password={os.getenv('DB_PASSWORD', '')} "
        f"host={os.getenv('DB_HOST', 'localhost')} "
        f"port={os.getenv('DB_PORT', '5432')}"
    )
