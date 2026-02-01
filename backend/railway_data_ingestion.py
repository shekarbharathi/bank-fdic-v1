"""
Script to ingest FDIC data into Railway PostgreSQL database
Run this once after setting up the database on Railway

Usage from Railway CLI:
  railway run python railway_data_ingestion.py
"""
import os
import sys

# Debug: Print current directory info
print(f"Script file: {__file__}")
print(f"Current working directory: {os.getcwd()}")
print(f"Script directory: {os.path.dirname(os.path.abspath(__file__))}")

# Add parent directory to path to access fdic_to_postgres.py
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
print(f"Parent directory: {parent_dir}")
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
    print(f"Added {parent_dir} to Python path")

from fdic_to_postgres import FDICAPIClient, PostgresLoader
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_db_connection_from_env():
    """Get database connection from Railway environment variables"""
    DATABASE_URL = os.getenv('DATABASE_URL', '')
    
    if DATABASE_URL:
        # Parse Railway's DATABASE_URL
        import re
        match = re.match(r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', DATABASE_URL)
        if match:
            user, password, host, port, dbname = match.groups()
            return (
                f"dbname={dbname} "
                f"user={user} "
                f"password={password} "
                f"host={host} "
                f"port={port}"
            )
    
    # Fallback to individual env vars
    return (
        f"dbname={os.getenv('DB_NAME', 'fdic')} "
        f"user={os.getenv('DB_USER', 'postgres')} "
        f"password={os.getenv('DB_PASSWORD', '')} "
        f"host={os.getenv('DB_HOST', 'localhost')} "
        f"port={os.getenv('DB_PORT', '5432')}"
    )


def main():
    """Run data ingestion for Railway deployment"""
    
    # Get connection from environment
    DB_CONNECTION = get_db_connection_from_env()
    API_KEY = os.getenv('FDIC_API_KEY', None)
    
    logger.info("Starting FDIC data ingestion for Railway...")
    logger.info(f"Database host: {os.getenv('DB_HOST', 'from DATABASE_URL')}")
    
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
    
    logger.info("Data ingestion complete!")


if __name__ == "__main__":
    main()
