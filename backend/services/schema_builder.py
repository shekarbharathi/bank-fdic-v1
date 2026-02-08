"""
Schema builder for generating database metadata for LLM context
"""
import os
import sys

# Handle imports for both Railway (backend as root) and local dev (project root)
if os.path.dirname(os.path.dirname(os.path.abspath(__file__))) not in sys.path:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, backend_dir)

from typing import Dict, Any, Optional

# Try relative imports first (for Railway), fallback to absolute (for local dev)
try:
    from services.database import DatabaseService
except ImportError:
    from backend.services.database import DatabaseService


class SchemaBuilder:
    """Build schema descriptions for LLM prompts"""
    
    def __init__(self, db_service: DatabaseService):
        self.db_service = db_service
        self._schema_cache: Optional[Dict[str, Any]] = None
    
    async def get_schema_description(self) -> str:
        """
        Generate a human-readable schema description for LLM prompts
        
        Returns:
            String description of database schema
        """
        schema_info = await self.db_service.get_schema_info()
        
        description = "Database Schema for FDIC Bank Data:\n\n"
        
        # Table descriptions
        table_descriptions = {
            'institutions': 'Bank institution data including name, location, assets, deposits, and status',
            'financials': 'Quarterly financial reports with assets, deposits, ROA, net income, and other metrics',
            'locations': 'Branch and location data for all FDIC-insured institutions',
            'history': 'Structure change events such as mergers, acquisitions, and name changes',
            'failures': 'Data on failed financial institutions'
        }
        
        for table in schema_info['tables']:
            table_name = table['name']
            description += f"Table: {table_name}\n"
            description += f"  Description: {table_descriptions.get(table_name, 'Banking data table')}\n"
            description += f"  Row count: {table['row_count']:,}\n"
            description += "  Columns:\n"
            
            for col in table['columns']:
                nullable = "NULL" if col['nullable'] else "NOT NULL"
                description += f"    - {col['name']} ({col['type']}) {nullable}\n"
            
            description += "\n"
        
        # Add relationships
        description += "Relationships:\n"
        description += "  - financials.cert references institutions.cert (many-to-one)\n"
        description += "  - locations.cert references institutions.cert (many-to-one)\n"
        description += "  - history.cert references institutions.cert (many-to-one)\n"
        description += "\n"
        
        # Add common field meanings
        description += "Important Field Meanings:\n"
        description += "  - cert: Certificate number (unique bank identifier)\n"
        description += "  - name: Bank name\n"
        description += "  - asset: Total assets in THOUSANDS of dollars (multiply by 1000 for actual dollars)\n"
        description += "  - dep: Total deposits in THOUSANDS of dollars (multiply by 1000 for actual dollars)\n"
        description += "  - depdom: Domestic deposits in THOUSANDS of dollars (multiply by 1000 for actual dollars)\n"
        description += "  - eqtot: Total equity capital in THOUSANDS of dollars (multiply by 1000 for actual dollars)\n"
        description += "  - netinc: Net income in THOUSANDS of dollars (multiply by 1000 for actual dollars)\n"
        description += "  - roa: Return on assets (percentage)\n"
        description += "  - repdte: Report date (YYYY-MM-DD format)\n"
        description += "  - active: 1 if bank is active, 0 if inactive\n"
        description += "  - stalp: State abbreviation (2 letters)\n"
        description += "  - stname: Full state name\n"
        description += "\n"
        description += "IMPORTANT: When users ask about assets, deposits, or other dollar amounts, "
        description += "you MUST multiply the database values by 1000 in your SQL query to show actual dollars. "
        description += "For example: SELECT name, asset * 1000 as assets_dollars FROM institutions;\n"
        
        return description
    
    async def get_example_queries(self) -> str:
        """
        Get example SQL queries for LLM context
        
        Returns:
            String with example queries
        """
        examples = """
Example SQL Queries:

1. "Top 10 banks by assets":
   SELECT name, city, stalp, asset * 1000 as assets_dollars, dep * 1000 as deposits_dollars
   FROM institutions
   WHERE active = 1 AND asset IS NOT NULL
   ORDER BY asset DESC
   LIMIT 10;

2. "JPMorgan Chase deposit growth over time":
   SELECT repdte, dep * 1000 as deposits_dollars, asset * 1000 as assets_dollars, roa
   FROM financials
   WHERE cert = 628
   ORDER BY repdte DESC;

3. "Banks in California with high ROA":
   SELECT i.name, i.city, f.roa, f.asset * 1000 as assets_dollars, f.dep * 1000 as deposits_dollars
   FROM institutions i
   JOIN financials f ON i.cert = f.cert
   WHERE i.stalp = 'CA'
     AND i.active = 1
     AND f.repdte = (SELECT MAX(repdte) FROM financials WHERE cert = i.cert)
     AND f.roa > 1.0
   ORDER BY f.roa DESC;

4. "Capital ratio for banks (equity/assets)":
   SELECT i.name, f.eqtot / NULLIF(f.asset, 0) * 100 as capital_ratio, f.asset * 1000 as assets_dollars
   FROM institutions i
   JOIN financials f ON i.cert = f.cert
   WHERE i.active = 1
     AND f.repdte = (SELECT MAX(repdte) FROM financials WHERE cert = i.cert)
     AND f.asset > 0
   ORDER BY capital_ratio DESC
   LIMIT 20;

5. "Deposit growth year over year":
   SELECT 
     f1.repdte as current_date,
     f1.dep * 1000 as current_deposits_dollars,
     f2.dep * 1000 as previous_deposits_dollars,
     (f1.dep - f2.dep) / NULLIF(f2.dep, 0) * 100 as growth_pct
   FROM financials f1
   JOIN financials f2 ON f1.cert = f2.cert 
     AND f2.repdte = f1.repdte - INTERVAL '1 year'
   WHERE f1.cert = 628
   ORDER BY f1.repdte DESC;
"""
        return examples
