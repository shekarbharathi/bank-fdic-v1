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
    Trigger FDIC data ingestion
    This endpoint runs the data ingestion script
    """
    try:
        # Import fdic_to_postgres (now in backend/ directory)
        # Try backend directory first, then parent directory as fallback
        try:
            from fdic_to_postgres import FDICAPIClient, PostgresLoader
        except ImportError:
            # Fallback: try importing from parent directory
            parent_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            if parent_dir not in sys.path:
                sys.path.insert(0, parent_dir)
            from fdic_to_postgres import FDICAPIClient, PostgresLoader
        
        logger.info("Starting data ingestion via API endpoint...")
        
        # Get database connection from environment
        DATABASE_URL = os.getenv('DATABASE_URL', '')
        
        if DATABASE_URL:
            import re
            match = re.match(r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', DATABASE_URL)
            if match:
                user, password, host, port, dbname = match.groups()
                DB_CONNECTION = (
                    f"dbname={dbname} "
                    f"user={user} "
                    f"password={password} "
                    f"host={host} "
                    f"port={port}"
                )
            else:
                raise ValueError("Invalid DATABASE_URL format")
        else:
            raise ValueError("DATABASE_URL not found")
        
        API_KEY = os.getenv('FDIC_API_KEY', None)
        
        # Initialize clients
        api_client = FDICAPIClient(api_key=API_KEY)
        db_loader = PostgresLoader(DB_CONNECTION)
        
        # Create database schema
        logger.info("Creating database schema...")
        db_loader.create_tables()
        
        # Fetch and load all institutions
        logger.info("Fetching all institutions...")
        institutions = api_client.get_institutions(
            filters="",
            fields="CERT,NAME,CITY,STALP,STNAME,ZIP,ASSET,DEP,DEPDOM,BKCLASS,CHARTER,DATEUPDT,ACTIVE,FED_RSSD"
        )
        db_loader.upsert_institutions(institutions)
        
        # Fetch recent financial data (last 2 years)
        logger.info("Fetching recent financial data...")
        financials = api_client.get_financials(
            filters="REPDTE:[2022-01-01 TO *]",
            fields="CERT,REPDTE,ASSET,DEP,DEPDOM,EQTOT,ROA,ROAPTX,NETINC,NIMY,LNLSNET,ELNATR"
        )
        db_loader.upsert_financials(financials)
        
        logger.info("Data ingestion completed successfully!")
        
        return {
            "status": "success",
            "message": "Data ingestion completed successfully",
            "institutions_loaded": len(institutions),
            "financials_loaded": len(financials)
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
