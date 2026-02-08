"""
Database service for PostgreSQL connection and query execution
"""
import os
import sys

# Handle imports for both Railway (backend as root) and local dev (project root)
if os.path.dirname(os.path.dirname(os.path.abspath(__file__))) not in sys.path:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, backend_dir)

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
import asyncio
from typing import List, Dict, Any, Optional
import logging

# Try relative imports first (for Railway), fallback to absolute (for local dev)
try:
    from config import DB_CONNECTION, MAX_QUERY_EXECUTION_TIME, MAX_RESULT_ROWS
except ImportError:
    from backend.config import DB_CONNECTION, MAX_QUERY_EXECUTION_TIME, MAX_RESULT_ROWS

logger = logging.getLogger(__name__)


class DatabaseService:
    """Service for database operations"""
    
    def __init__(self):
        """Initialize database connection pool"""
        self.connection_pool = None
        self._initialize_pool()
    
    def _initialize_pool(self):
        """Initialize connection pool"""
        try:
            self.connection_pool = psycopg2.pool.SimpleConnectionPool(
                1, 20,  # min 1, max 20 connections
                DB_CONNECTION
            )
            if self.connection_pool:
                logger.info("Database connection pool created successfully")
        except Exception as e:
            logger.error(f"Error creating connection pool: {e}")
            raise
    
    async def check_connection(self) -> bool:
        """Check if database connection is working"""
        try:
            conn = self.connection_pool.getconn()
            if conn:
                cur = conn.cursor()
                cur.execute("SELECT 1")
                cur.close()
                self.connection_pool.putconn(conn)
                return True
        except Exception as e:
            logger.error(f"Database connection check failed: {e}")
            return False
        return False
    
    async def execute_query(self, sql: str) -> List[Dict[str, Any]]:
        """
        Execute SQL query and return results as list of dictionaries
        
        Args:
            sql: SQL query string
            
        Returns:
            List of dictionaries representing rows
        """
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._execute_query_sync, sql
        )
    
    def _execute_query_sync(self, sql: str) -> List[Dict[str, Any]]:
        """Synchronous query execution"""
        conn = None
        try:
            conn = self.connection_pool.getconn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Set statement timeout
            cur.execute(f"SET statement_timeout = {MAX_QUERY_EXECUTION_TIME * 1000}")  # milliseconds
            
            # Execute query
            cur.execute(sql)
            
            # Fetch results with limit
            results = cur.fetchmany(MAX_RESULT_ROWS)
            
            # Convert to list of dicts, converting Decimal to float for JSON serialization
            from decimal import Decimal
            rows = []
            for row in results:
                row_dict = {}
                for key, value in dict(row).items():
                    if isinstance(value, Decimal):
                        row_dict[key] = float(value)
                    else:
                        row_dict[key] = value
                rows.append(row_dict)
            
            cur.close()
            self.connection_pool.putconn(conn)
            
            return rows
            
        except psycopg2.errors.QueryCanceled:
            logger.warning("Query execution timeout")
            if conn:
                self.connection_pool.putconn(conn)
            raise Exception("Query execution timeout exceeded")
        except Exception as e:
            logger.error(f"Query execution error: {e}")
            if conn:
                self.connection_pool.putconn(conn)
            raise
    
    async def get_schema_info(self) -> Dict[str, Any]:
        """
        Get database schema information for LLM context
        
        Returns:
            Dictionary with schema information
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._get_schema_info_sync
        )
    
    def _get_schema_info_sync(self) -> Dict[str, Any]:
        """Synchronous schema info retrieval"""
        conn = None
        try:
            conn = self.connection_pool.getconn()
            cur = conn.cursor()
            
            schema_info = {
                'tables': []
            }
            
            # Get table information
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            
            tables = [row[0] for row in cur.fetchall()]
            
            for table in tables:
                # Get columns for each table
                cur.execute("""
                    SELECT 
                        column_name,
                        data_type,
                        is_nullable,
                        column_default
                    FROM information_schema.columns
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                    ORDER BY ordinal_position
                """, (table,))
                
                columns = [
                    {
                        'name': row[0],
                        'type': row[1],
                        'nullable': row[2] == 'YES',
                        'default': row[3]
                    }
                    for row in cur.fetchall()
                ]
                
                # Get row count
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                row_count = cur.fetchone()[0]
                
                schema_info['tables'].append({
                    'name': table,
                    'columns': columns,
                    'row_count': row_count
                })
            
            cur.close()
            self.connection_pool.putconn(conn)
            
            return schema_info
            
        except Exception as e:
            logger.error(f"Error getting schema info: {e}")
            if conn:
                self.connection_pool.putconn(conn)
            raise
    
    def close(self):
        """Close all connections in pool"""
        if self.connection_pool:
            self.connection_pool.closeall()
            logger.info("Database connection pool closed")
