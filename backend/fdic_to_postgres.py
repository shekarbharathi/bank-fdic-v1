"""
FDIC API to PostgreSQL Ingestion Script

This script demonstrates how to fetch data from FDIC API and load it into PostgreSQL.
It includes examples for all major endpoints with proper error handling and pagination.
"""

import requests
import psycopg2
from psycopg2.extras import execute_values
import time
from datetime import datetime
from typing import List, Dict, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FDICAPIClient:
    """Client for interacting with FDIC BankFind Suite API"""
    
    BASE_URL = "https://banks.data.fdic.gov/api"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize FDIC API client
        
        Args:
            api_key: Optional API key (not currently required but recommended)
        """
        self.api_key = api_key
        self.session = requests.Session()
        if api_key:
            self.session.headers.update({'X-API-KEY': api_key})
    
    def _make_request(self, endpoint: str, params: Dict) -> Dict:
        """
        Make API request with error handling
        
        Args:
            endpoint: API endpoint (e.g., 'institutions', 'financials')
            params: Query parameters
            
        Returns:
            JSON response data
        """
        url = f"{self.BASE_URL}/{endpoint}"
        params['format'] = 'json'
        
        try:
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise
    
    def fetch_all_pages(self, endpoint: str, filters: str = "", 
                       fields: str = "", limit: int = 10000) -> List[Dict]:
        """
        Fetch all pages of data using pagination
        
        Args:
            endpoint: API endpoint
            filters: Elasticsearch query string
            fields: Comma-separated list of fields
            limit: Records per request (max 10000)
            
        Returns:
            List of all records
        """
        all_data = []
        offset = 0
        
        while True:
            params = {
                'limit': limit,
                'offset': offset
            }
            if filters:
                params['filters'] = filters
            if fields:
                params['fields'] = fields
            
            logger.info(f"Fetching {endpoint}: offset={offset}, limit={limit}")
            response = self._make_request(endpoint, params)
            
            data = response.get('data', [])
            if not data:
                break
            
            all_data.extend(data)
            
            # Check if there are more records
            total = response.get('meta', {}).get('total', 0)
            if offset + limit >= total:
                break
            
            offset += limit
            time.sleep(0.5)  # Be nice to the API
        
        logger.info(f"Fetched {len(all_data)} total records from {endpoint}")
        return all_data
    
    def get_institutions(self, filters: str = "", fields: str = "") -> List[Dict]:
        """Fetch institution data"""
        return self.fetch_all_pages('institutions', filters, fields)
    
    def get_financials(self, filters: str = "", fields: str = "") -> List[Dict]:
        """Fetch financial data"""
        return self.fetch_all_pages('financials', filters, fields)
    
    def get_locations(self, filters: str = "", fields: str = "") -> List[Dict]:
        """Fetch location/branch data"""
        return self.fetch_all_pages('locations', filters, fields)
    
    def get_history(self, filters: str = "", fields: str = "") -> List[Dict]:
        """Fetch history/structure change data"""
        return self.fetch_all_pages('history', filters, fields)
    
    def get_failures(self, filters: str = "", fields: str = "") -> List[Dict]:
        """Fetch failed institution data"""
        return self.fetch_all_pages('failures', filters, fields)


class PostgresLoader:
    """Load FDIC data into PostgreSQL"""
    
    def __init__(self, connection_string: str):
        """
        Initialize PostgreSQL loader
        
        Args:
            connection_string: PostgreSQL connection string
                Example: "dbname=fdic user=postgres password=secret host=localhost"
        """
        self.conn_string = connection_string
    
    def create_tables(self):
        """Create database schema for FDIC data"""
        
        create_tables_sql = """
        -- Institutions table
        CREATE TABLE IF NOT EXISTS institutions (
            cert INTEGER PRIMARY KEY,
            name VARCHAR(255),
            city VARCHAR(100),
            stalp VARCHAR(2),
            stname VARCHAR(50),
            zip VARCHAR(10),
            asset NUMERIC,
            dep NUMERIC,
            depdom NUMERIC,
            bkclass VARCHAR(5),
            charter VARCHAR(10),
            dateupdt DATE,
            active INTEGER,
            fed_rssd INTEGER,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_institutions_name ON institutions(name);
        CREATE INDEX IF NOT EXISTS idx_institutions_state ON institutions(stalp);
        CREATE INDEX IF NOT EXISTS idx_institutions_active ON institutions(active);
        
        -- Financials table
        CREATE TABLE IF NOT EXISTS financials (
            id SERIAL PRIMARY KEY,
            cert INTEGER,  -- Removed foreign key constraint to allow historical data
            repdte DATE,
            asset NUMERIC,
            dep NUMERIC,
            depdom NUMERIC,
            eqtot NUMERIC,
            roa NUMERIC,
            roaptx NUMERIC,
            netinc NUMERIC,
            nimy NUMERIC,
            lnlsnet NUMERIC,
            elnatr NUMERIC,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(cert, repdte)
        );
        CREATE INDEX IF NOT EXISTS idx_financials_cert ON financials(cert);
        CREATE INDEX IF NOT EXISTS idx_financials_date ON financials(repdte);
        
        -- Locations table
        CREATE TABLE IF NOT EXISTS locations (
            id SERIAL PRIMARY KEY,
            cert INTEGER REFERENCES institutions(cert),
            uninum INTEGER,
            name VARCHAR(255),
            address VARCHAR(255),
            city VARCHAR(100),
            stalp VARCHAR(2),
            stname VARCHAR(50),
            zip VARCHAR(10),
            county VARCHAR(100),
            cbsa VARCHAR(100),
            cbsa_div VARCHAR(100),
            servtype INTEGER,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(cert, uninum)
        );
        CREATE INDEX IF NOT EXISTS idx_locations_cert ON locations(cert);
        CREATE INDEX IF NOT EXISTS idx_locations_state ON locations(stalp);
        
        -- History table
        CREATE TABLE IF NOT EXISTS history (
            id SERIAL PRIMARY KEY,
            cert INTEGER,
            procdate DATE,
            changecode INTEGER,
            changecode_desc VARCHAR(255),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_history_cert ON history(cert);
        CREATE INDEX IF NOT EXISTS idx_history_date ON history(procdate);
        
        -- Failures table
        CREATE TABLE IF NOT EXISTS failures (
            cert INTEGER PRIMARY KEY,
            name VARCHAR(255),
            city VARCHAR(100),
            stalp VARCHAR(2),
            faildate DATE,
            qbfdep NUMERIC,
            qbfasset NUMERIC,
            cost NUMERIC,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_failures_date ON failures(faildate);
        """
        
        with psycopg2.connect(self.conn_string) as conn:
            with conn.cursor() as cur:
                cur.execute(create_tables_sql)
                conn.commit()
        
        logger.info("Database tables created successfully")
    
    def upsert_institutions(self, data: List[Dict]):
        """Insert or update institution data"""
        if not data:
            return
        
        sql = """
        INSERT INTO institutions (
            cert, name, city, stalp, stname, zip, asset, dep, depdom,
            bkclass, charter, dateupdt, active, fed_rssd
        ) VALUES %s
        ON CONFLICT (cert) DO UPDATE SET
            name = EXCLUDED.name,
            city = EXCLUDED.city,
            stalp = EXCLUDED.stalp,
            stname = EXCLUDED.stname,
            zip = EXCLUDED.zip,
            asset = EXCLUDED.asset,
            dep = EXCLUDED.dep,
            depdom = EXCLUDED.depdom,
            bkclass = EXCLUDED.bkclass,
            charter = EXCLUDED.charter,
            dateupdt = EXCLUDED.dateupdt,
            active = EXCLUDED.active,
            fed_rssd = EXCLUDED.fed_rssd,
            updated_at = CURRENT_TIMESTAMP
        """
        
        values = [
            (
                row.get('data', {}).get('CERT'),
                row.get('data', {}).get('NAME'),
                row.get('data', {}).get('CITY'),
                row.get('data', {}).get('STALP'),
                row.get('data', {}).get('STNAME'),
                row.get('data', {}).get('ZIP'),
                row.get('data', {}).get('ASSET'),
                row.get('data', {}).get('DEP'),
                row.get('data', {}).get('DEPDOM'),
                row.get('data', {}).get('BKCLASS'),
                row.get('data', {}).get('CHARTER'),
                row.get('data', {}).get('DATEUPDT'),
                row.get('data', {}).get('ACTIVE'),
                row.get('data', {}).get('FED_RSSD')
            )
            for row in data
        ]
        
        with psycopg2.connect(self.conn_string) as conn:
            with conn.cursor() as cur:
                execute_values(cur, sql, values)
                conn.commit()
        
        logger.info(f"Upserted {len(values)} institution records")
    
    def upsert_financials(self, data: List[Dict]):
        """Insert or update financial data"""
        if not data:
            return
        
        sql = """
        INSERT INTO financials (
            cert, repdte, asset, dep, depdom, eqtot, roa, roaptx,
            netinc, nimy, lnlsnet, elnatr
        ) VALUES %s
        ON CONFLICT (cert, repdte) DO UPDATE SET
            asset = EXCLUDED.asset,
            dep = EXCLUDED.dep,
            depdom = EXCLUDED.depdom,
            eqtot = EXCLUDED.eqtot,
            roa = EXCLUDED.roa,
            roaptx = EXCLUDED.roaptx,
            netinc = EXCLUDED.netinc,
            nimy = EXCLUDED.nimy,
            lnlsnet = EXCLUDED.lnlsnet,
            elnatr = EXCLUDED.elnatr,
            updated_at = CURRENT_TIMESTAMP
        """
        
        values = [
            (
                row.get('data', {}).get('CERT'),
                row.get('data', {}).get('REPDTE'),
                row.get('data', {}).get('ASSET'),
                row.get('data', {}).get('DEP'),
                row.get('data', {}).get('DEPDOM'),
                row.get('data', {}).get('EQTOT'),
                row.get('data', {}).get('ROA'),
                row.get('data', {}).get('ROAPTX'),
                row.get('data', {}).get('NETINC'),
                row.get('data', {}).get('NIMY'),
                row.get('data', {}).get('LNLSNET'),
                row.get('data', {}).get('ELNATR')
            )
            for row in data
        ]
        
        with psycopg2.connect(self.conn_string) as conn:
            with conn.cursor() as cur:
                execute_values(cur, sql, values)
                conn.commit()
        
        logger.info(f"Upserted {len(values)} financial records")


def main():
    """Example usage: Full data pipeline"""
    
    # Configuration - try to import from config.py, otherwise use defaults
    try:
        from config import DB_CONNECTION, API_KEY
    except ImportError:
        import os
        # Fallback to environment variables or defaults
        DB_CONNECTION = (
            f"dbname={os.getenv('DB_NAME', 'fdic')} "
            f"user={os.getenv('DB_USER', 'postgres')} "
            f"password={os.getenv('DB_PASSWORD', 'yourpassword')} "
            f"host={os.getenv('DB_HOST', 'localhost')} "
            f"port={os.getenv('DB_PORT', '5432')}"
        )
        API_KEY = os.getenv('FDIC_API_KEY', None)
    
    # Initialize clients
    api_client = FDICAPIClient(api_key=API_KEY)
    db_loader = PostgresLoader(DB_CONNECTION)
    
    # Create database schema
    logger.info("Creating database schema...")
    db_loader.create_tables()
    
    # Example 1: Fetch and load all institutions (active and inactive)
    # We fetch all to ensure financial records have matching institutions
    logger.info("Fetching all institutions (active and inactive)...")
    institutions = api_client.get_institutions(
        filters="",  # Fetch all institutions, not just active ones
        fields="CERT,NAME,CITY,STALP,STNAME,ZIP,ASSET,DEP,DEPDOM,BKCLASS,CHARTER,DATEUPDT,ACTIVE,FED_RSSD"
    )
    db_loader.upsert_institutions(institutions)
    
    # Example 2: Fetch recent financial data (last 2 years)
    logger.info("Fetching recent financial data...")
    financials = api_client.get_financials(
        filters="REPDTE:[2022-01-01 TO *]",
        fields="CERT,REPDTE,ASSET,DEP,DEPDOM,EQTOT,ROA,ROAPTX,NETINC,NIMY,LNLSNET,ELNATR"
    )
    db_loader.upsert_financials(financials)
    
    # Example 3: Fetch specific bank's data (JPMorgan Chase example - CERT 628)
    logger.info("Fetching JPMorgan Chase data...")
    jpmorgan_financials = api_client.get_financials(
        filters="CERT:628",
        fields="CERT,REPDTE,ASSET,DEP,ROA,NETINC"
    )
    db_loader.upsert_financials(jpmorgan_financials)
    
    logger.info("Data ingestion complete!")


if __name__ == "__main__":
    main()
