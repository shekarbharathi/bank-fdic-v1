"""
Data ingestion API endpoint
This allows triggering data ingestion via HTTP request instead of railway run
"""
from fastapi import APIRouter, HTTPException
import os
import sys
import logging
from typing import Dict, Any

router = APIRouter()
logger = logging.getLogger(__name__)

# Add backend directory to path (fdic_to_postgres.py is now in backend/)
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Also try parent directory in case Railway includes it
parent_dir = os.path.dirname(backend_dir)  # project root/
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

logger.info(f"Backend dir: {backend_dir}")
logger.info(f"Parent dir: {parent_dir}")
logger.info(f"Python path: {sys.path[:3]}")


@router.post("/api/data/ingest")
async def ingest_data() -> Dict[str, Any]:
    """
    Trigger optimized FDIC refresh (prune + upsert). Prefer `railway run python railway_data_ingestion.py`
    for long jobs; this endpoint may hit HTTP timeouts on large databases.
    """
    import asyncio

    try:
        try:
            from fdic_optimized_ingestion import run_refresh
        except ImportError:
            from backend.fdic_optimized_ingestion import run_refresh

        if not os.getenv("DATABASE_URL", "").strip():
            env_vars = {k: v for k, v in os.environ.items() if "DATABASE" in k or "DB_" in k or "PG" in k}
            logger.error("DATABASE_URL not found. Available DB-related env vars: %s", list(env_vars.keys()))
            raise ValueError(
                "DATABASE_URL not found. Connect PostgreSQL to the backend service in Railway."
            )

        logger.info("Starting optimized FDIC refresh via API (prune + ingest)...")
        loop = asyncio.get_event_loop()
        summary = await loop.run_in_executor(None, run_refresh)
        logger.info("Data refresh completed: max_repdte=%s", summary.get("after", {}).get("max_repdte"))

        return {
            "status": "success",
            "message": "Optimized FDIC refresh completed (see prune/after in response)",
            **summary,
        }

    except Exception as e:
        logger.error(f"Error during data ingestion: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Data ingestion failed: {str(e)}"
        )


@router.get("/api/data/ingest/status")
async def get_ingestion_status() -> Dict[str, Any]:
    """
    Check if data ingestion is running or get status
    """
    # Simple status check - can be enhanced with actual job tracking
    return {
        "status": "ready",
        "message": "Use POST /api/data/ingest to trigger ingestion"
    }
