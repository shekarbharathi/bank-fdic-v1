"""
SQL validator with safety checks and injection prevention
"""
import re
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)


class SQLValidator:
    """Validate and sanitize SQL queries"""
    
    # Dangerous SQL keywords that should not be allowed
    DANGEROUS_KEYWORDS = [
        'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE',
        'TRUNCATE', 'EXEC', 'EXECUTE', 'GRANT', 'REVOKE'
    ]
    
    # Allowed SQL keywords (SELECT queries only)
    ALLOWED_KEYWORDS = [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN',
        'RIGHT JOIN', 'FULL JOIN', 'ON', 'GROUP BY', 'ORDER BY',
        'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'AS', 'AND', 'OR',
        'NOT', 'IN', 'LIKE', 'ILIKE', 'BETWEEN', 'IS NULL', 'IS NOT NULL',
        'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'CASE', 'WHEN', 'THEN',
        'ELSE', 'END', 'UNION', 'INTERSECT', 'EXCEPT'
    ]
    
    def __init__(self):
        self.allowed_tables = [
            'institutions', 'financials', 'locations', 'history', 'failures'
        ]
    
    def validate(self, sql: str) -> Tuple[bool, Optional[str]]:
        """
        Validate SQL query for safety
        
        Args:
            sql: SQL query string
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not sql or not sql.strip():
            return False, "Empty SQL query"
        
        # Normalize SQL (uppercase for keyword checking)
        sql_upper = sql.upper().strip()
        
        # Check for dangerous keywords
        for keyword in self.DANGEROUS_KEYWORDS:
            # Use word boundaries to avoid false positives
            pattern = r'\b' + re.escape(keyword) + r'\b'
            if re.search(pattern, sql_upper):
                return False, f"Dangerous SQL keyword detected: {keyword}"
        
        # Must start with SELECT
        if not sql_upper.startswith('SELECT'):
            return False, "Only SELECT queries are allowed"
        
        # Check for SQL injection patterns
        injection_patterns = [
            r';\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE)',
            r'--',  # SQL comments
            r'/\*.*\*/',  # Multi-line comments
            r'UNION.*SELECT',  # Union-based injection
            r'EXEC\s*\(',  # Executable code
        ]
        
        for pattern in injection_patterns:
            if re.search(pattern, sql_upper, re.IGNORECASE | re.DOTALL):
                return False, f"Potential SQL injection detected: {pattern}"
        
        # Check that only allowed tables are referenced
        # Extract table names from FROM and JOIN clauses
        table_pattern = r'\b(?:FROM|JOIN)\s+(\w+)'
        matches = re.findall(table_pattern, sql_upper)
        
        for table in matches:
            if table.lower() not in self.allowed_tables:
                return False, f"Table '{table}' is not allowed. Allowed tables: {', '.join(self.allowed_tables)}"
        
        # Check for semicolons (should not have multiple statements)
        if sql.count(';') > 1:
            return False, "Multiple statements not allowed"
        
        # Basic syntax check - ensure balanced parentheses
        if sql.count('(') != sql.count(')'):
            return False, "Unbalanced parentheses in SQL query"
        
        return True, None
    
    def extract_sql_from_markdown(self, text: str) -> str:
        """
        Extract SQL query from markdown code blocks if present
        
        Args:
            text: Text that may contain SQL in markdown code blocks
            
        Returns:
            Extracted SQL query
        """
        # Look for SQL in markdown code blocks
        sql_pattern = r'```(?:sql)?\s*(.*?)```'
        matches = re.findall(sql_pattern, text, re.DOTALL | re.IGNORECASE)
        
        if matches:
            return matches[0].strip()
        
        # Look for SQL in inline code blocks
        inline_pattern = r'`([^`]+)`'
        matches = re.findall(inline_pattern, text)
        
        # If we find something that looks like SQL, return it
        for match in matches:
            if 'SELECT' in match.upper():
                return match.strip()
        
        # Return original text if no code blocks found
        return text.strip()
    
    def sanitize(self, sql: str) -> str:
        """
        Sanitize SQL query (remove comments, normalize whitespace)
        
        Args:
            sql: SQL query string
            
        Returns:
            Sanitized SQL query
        """
        # Remove SQL comments
        sql = re.sub(r'--.*$', '', sql, flags=re.MULTILINE)
        sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.DOTALL)
        
        # Normalize whitespace
        sql = ' '.join(sql.split())
        
        return sql.strip()
