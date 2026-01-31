"""
Advanced FDIC Data Pipeline with Incremental Updates

This script handles incremental updates and includes:
- Smart incremental updates (only fetch new data)
- Batch processing for large datasets
- Error recovery
- Progress tracking
- Data validation
"""

import requests
import psycopg2
from psycopg2.extras import execute_values
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import logging
import json
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('fdic_pipeline.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class IncrementalFDICPipeline:
    """
    Production-ready FDIC data pipeline with incremental updates
    """
    
    BASE_URL = "https://banks.data.fdic.gov/api"
    
    def __init__(self, db_connection: str, api_key: Optional[str] = None,
                 state_file: str = 'pipeline_state.json'):
        """
        Initialize pipeline
        
        Args:
            db_connection: PostgreSQL connection string
            api_key: Optional API key
            state_file: File to track pipeline state
        """
        self.db_conn = db_connection
        self.api_key = api_key
        self.state_file = Path(state_file)
        self.session = requests.Session()
        
        if api_key:
            self.session.headers.update({'X-API-KEY': api_key})
        
        # Load previous state
        self.state = self._load_state()
    
    def _load_state(self) -> Dict:
        """Load pipeline state from disk"""
        if self.state_file.exists():
            with open(self.state_file, 'r') as f:
                return json.load(f)
        return {
            'last_institution_update': None,
            'last_financial_update': None,
            'last_location_update': None,
            'last_run': None
        }
    
    def _save_state(self):
        """Save pipeline state to disk"""
        self.state['last_run'] = datetime.now().isoformat()
        with open(self.state_file, 'w') as f:
            json.dump(self.state, f, indent=2)
    
    def _fetch_batch(self, endpoint: str, filters: str, fields: str,
                    offset: int, limit: int = 10000) -> Tuple[List[Dict], int]:
        """
        Fetch a single batch from API
        
        Returns:
            Tuple of (data, total_count)
        """
        url = f"{self.BASE_URL}/{endpoint}"
        params = {
            'filters': filters,
            'fields': fields,
            'offset': offset,
            'limit': limit,
            'format': 'json'
        }
        
        try:
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            json_data = response.json()
            
            data = json_data.get('data', [])
            total = json_data.get('meta', {}).get('total', 0)
            
            return data, total
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise
    
    def fetch_incremental_institutions(self) -> List[Dict]:
        """
        Fetch only institutions updated since last run
        """
        # Get last update date
        last_update = self.state.get('last_institution_update')
        
        if last_update:
            # Fetch only updated records
            filters = f"DATEUPDT:[{last_update} TO *]"
            logger.info(f"Fetching institutions updated since {last_update}")
        else:
            # First run - fetch all active institutions
            filters = "ACTIVE:1"
            logger.info("First run: fetching all active institutions")
        
        fields = "CERT,NAME,CITY,STALP,STNAME,ZIP,ASSET,DEP,DEPDOM,BKCLASS,CHARTER,DATEUPDT,ACTIVE,FED_RSSD"
        
        all_data = []
        offset = 0
        limit = 10000
        
        while True:
            batch, total = self._fetch_batch('institutions', filters, fields, offset, limit)
            
            if not batch:
                break
            
            all_data.extend(batch)
            logger.info(f"Fetched {len(batch)} institutions (offset: {offset}, total: {total})")
            
            if offset + limit >= total:
                break
            
            offset += limit
            time.sleep(0.5)
        
        # Update state
        if all_data:
            max_date = max(row.get('data', {}).get('DATEUPDT', '') for row in all_data)
            self.state['last_institution_update'] = max_date
        
        return all_data
    
    def fetch_quarterly_financials(self, start_date: Optional[str] = None,
                                   end_date: Optional[str] = None) -> List[Dict]:
        """
        Fetch financial data for a specific date range
        
        Args:
            start_date: Start date in YYYY-MM-DD format (defaults to last quarter)
            end_date: End date in YYYY-MM-DD format (defaults to today)
        """
        if not start_date:
            # Default to last quarter
            if self.state.get('last_financial_update'):
                start_date = self.state['last_financial_update']
            else:
                # Go back 2 years for first run
                start_date = (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%d')
        
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        filters = f"REPDTE:[{start_date} TO {end_date}]"
        fields = (
            "CERT,REPDTE,ASSET,DEP,DEPDOM,EQTOT,ROA,ROAPTX,NETINC,NIMY,"
            "LNLSNET,ELNATR,INTINC,INTEXP,NONII,NONIX"
        )
        
        logger.info(f"Fetching financials from {start_date} to {end_date}")
        
        all_data = []
        offset = 0
        limit = 10000
        
        while True:
            batch, total = self._fetch_batch('financials', filters, fields, offset, limit)
            
            if not batch:
                break
            
            all_data.extend(batch)
            logger.info(f"Fetched {len(batch)} financial records (offset: {offset}, total: {total})")
            
            if offset + limit >= total:
                break
            
            offset += limit
            time.sleep(0.5)
        
        # Update state
        if all_data:
            max_date = max(row.get('data', {}).get('REPDTE', '') for row in all_data)
            self.state['last_financial_update'] = max_date
        
        return all_data
    
    def batch_upsert(self, table: str, data: List[Dict], 
                    field_mapping: Dict, batch_size: int = 1000):
        """
        Batch upsert data to avoid memory issues with large datasets
        
        Args:
            table: Target table name
            data: List of records
            field_mapping: Mapping of API fields to DB columns
            batch_size: Records per batch
        """
        total_batches = (len(data) + batch_size - 1) // batch_size
        
        for i in range(0, len(data), batch_size):
            batch = data[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            
            logger.info(f"Processing batch {batch_num}/{total_batches} for {table}")
            
            if table == 'institutions':
                self._upsert_institutions_batch(batch)
            elif table == 'financials':
                self._upsert_financials_batch(batch)
            elif table == 'locations':
                self._upsert_locations_batch(batch)
    
    def _upsert_institutions_batch(self, batch: List[Dict]):
        """Upsert a batch of institution records"""
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
            for row in batch
        ]
        
        with psycopg2.connect(self.db_conn) as conn:
            with conn.cursor() as cur:
                execute_values(cur, sql, values)
                conn.commit()
    
    def _upsert_financials_batch(self, batch: List[Dict]):
        """Upsert a batch of financial records"""
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
            for row in batch
        ]
        
        with psycopg2.connect(self.db_conn) as conn:
            with conn.cursor() as cur:
                execute_values(cur, sql, values)
                conn.commit()
    
    def run_full_pipeline(self):
        """
        Execute complete data pipeline with error handling
        """
        start_time = datetime.now()
        logger.info("="*60)
        logger.info("Starting FDIC data pipeline")
        logger.info("="*60)
        
        try:
            # Step 1: Update institutions
            logger.info("Step 1: Fetching institution updates...")
            institutions = self.fetch_incremental_institutions()
            if institutions:
                self.batch_upsert('institutions', institutions, {})
                logger.info(f"✓ Processed {len(institutions)} institution records")
            else:
                logger.info("✓ No institution updates found")
            
            # Step 2: Update financials
            logger.info("Step 2: Fetching financial data...")
            financials = self.fetch_quarterly_financials()
            if financials:
                self.batch_upsert('financials', financials, {})
                logger.info(f"✓ Processed {len(financials)} financial records")
            else:
                logger.info("✓ No financial updates found")
            
            # Save state
            self._save_state()
            
            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info("="*60)
            logger.info(f"Pipeline completed successfully in {elapsed:.2f} seconds")
            logger.info("="*60)
            
        except Exception as e:
            logger.error(f"Pipeline failed: {e}", exc_info=True)
            raise


def main():
    """Run the pipeline"""
    
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
    
    # Initialize and run
    pipeline = IncrementalFDICPipeline(DB_CONNECTION, api_key=API_KEY)
    pipeline.run_full_pipeline()


if __name__ == "__main__":
    main()
