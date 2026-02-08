"""
Response formatter for converting query results to natural language
"""
from typing import List, Dict, Any, Optional
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)


class ResponseFormatter:
    """Format database query results into natural language responses"""
    
    # Columns that store values in thousands of dollars
    DOLLAR_COLUMNS_IN_THOUSANDS = {'asset', 'dep', 'depdom', 'eqtot', 'netinc', 'lnlsnet', 
                                    'qbfasset', 'qbfdep', 'cost', 'assets_dollars', 'deposits_dollars',
                                    'current_deposits_dollars', 'previous_deposits_dollars'}
    
    def _convert_thousands_to_dollars(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Convert dollar amounts from thousands to actual dollars.
        Only converts if the column name suggests it's in thousands and hasn't been converted yet.
        
        Args:
            results: Query results as list of dictionaries
            
        Returns:
            Results with dollar amounts converted to actual dollars
        """
        if not results:
            return results
        
        converted_results = []
        for row in results:
            converted_row = {}
            for col, val in row.items():
                col_lower = col.lower()
                # Check if this is a dollar column that might be in thousands
                # If column name contains "_dollars", it's already been converted by SQL
                # If column is just "asset", "dep", etc., check if value seems like thousands
                if col_lower in self.DOLLAR_COLUMNS_IN_THOUSANDS and isinstance(val, (int, float)) and val is not None:
                    # If column name already indicates dollars, don't convert
                    if '_dollars' in col_lower:
                        converted_row[col] = val
                    else:
                        # Convert from thousands to actual dollars
                        # Only convert if value seems reasonable for thousands (not already in billions)
                        if abs(val) < 10_000_000:  # If less than 10 trillion in thousands, likely needs conversion
                            converted_row[col] = val * 1000
                        else:
                            converted_row[col] = val
                else:
                    converted_row[col] = val
            converted_results.append(converted_row)
        
        return converted_results
    
    def _should_show_actual_values(self, user_question: str) -> bool:
        """
        Check if user explicitly wants to see actual values
        
        Args:
            user_question: User's question
            
        Returns:
            True if user wants actual values, False otherwise
        """
        question_lower = user_question.lower()
        actual_value_keywords = [
            'actual values', 'actual value', 'exact', 'exact values',
            'full number', 'full numbers', 'complete values', 'precise',
            'show all digits', 'no rounding', 'unrounded'
        ]
        return any(keyword in question_lower for keyword in actual_value_keywords)
    
    def _is_date_column(self, col_name: str) -> bool:
        """
        Check if a column name indicates it's a date column
        
        Args:
            col_name: Column name to check
            
        Returns:
            True if column appears to be a date column
        """
        col_lower = col_name.lower()
        date_keywords = ['date', 'repdte', 'faildate', 'procdate', 'dateupdt']
        return any(keyword in col_lower for keyword in date_keywords)
    
    def _to_float(self, val: Any) -> Optional[float]:
        """
        Convert various numeric types to float
        
        Args:
            val: Value to convert (int, float, Decimal, string, etc.)
            
        Returns:
            Float value or None if conversion fails
        """
        if val is None:
            return None
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, Decimal):
            return float(val)
        if isinstance(val, str):
            try:
                # Remove commas and try to parse
                cleaned = val.replace(',', '').strip()
                return float(cleaned)
            except (ValueError, AttributeError):
                return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None
    
    def _format_number(self, val: Any, show_actual: bool = False, is_dollar: bool = True) -> str:
        """
        Format a number according to rounding rules or show actual value
        
        Args:
            val: Numeric value to format (int, float, Decimal, or string)
            show_actual: If True, show full number. If False, round to nearest unit.
            is_dollar: If True, add $ prefix. If False, format as regular number.
            
        Returns:
            Formatted string representation
        """
        # Convert to float first
        float_val = self._to_float(val)
        if float_val is None:
            return str(val)  # Return as string if can't convert
        
        prefix = "$" if is_dollar else ""
        
        if show_actual:
            # Show actual value with comma separators
            if float_val.is_integer():
                return f"{prefix}{int(float_val):,}"
            else:
                return f"{prefix}{float_val:,.2f}"
        
        abs_val = abs(float_val)
        sign = "-" if float_val < 0 else ""
        
        # Round to nearest unit with up to 2 decimals
        if abs_val >= 1_000_000_000_000:  # Trillions
            rounded = round(float_val / 1_000_000_000_000, 2)
            return f"{sign}{prefix}{abs(rounded):.2f}T"
        elif abs_val >= 1_000_000_000:  # Billions
            rounded = round(float_val / 1_000_000_000, 2)
            return f"{sign}{prefix}{abs(rounded):.2f}B"
        elif abs_val >= 1_000_000:  # Millions
            rounded = round(float_val / 1_000_000, 2)
            return f"{sign}{prefix}{abs(rounded):.2f}M"
        elif abs_val >= 1_000:  # Thousands
            rounded = round(float_val / 1_000, 2)
            return f"{sign}{prefix}{abs(rounded):.2f}K"
        else:
            # Less than 1000, show as-is with 2 decimals if float
            if float_val.is_integer():
                return f"{sign}{prefix}{int(abs_val)}"
            else:
                return f"{sign}{prefix}{abs_val:.2f}"
    
    def format_response(
        self,
        user_question: str,
        sql_query: str,
        results: List[Dict[str, Any]]
    ) -> str:
        """
        Format query results into a natural language response
        
        Args:
            user_question: Original user question
            sql_query: SQL query that was executed
            results: Query results as list of dictionaries
            
        Returns:
            Formatted natural language response
        """
        if not results:
            return self._format_empty_response(user_question)
        
        # Convert dollar amounts from thousands to actual dollars
        results = self._convert_thousands_to_dollars(results)
        
        # Check if user wants actual values
        show_actual = self._should_show_actual_values(user_question)
        
        # Detect question type and format accordingly
        question_lower = user_question.lower()
        
        if any(word in question_lower for word in ['top', 'best', 'highest', 'largest']):
            return self._format_ranking_response(user_question, results, show_actual)
        elif any(word in question_lower for word in ['trend', 'growth', 'over time', 'history']):
            return self._format_trend_response(user_question, results, show_actual)
        elif any(word in question_lower for word in ['count', 'how many', 'number']):
            return self._format_count_response(user_question, results)
        elif 'ratio' in question_lower or 'capital' in question_lower:
            return self._format_ratio_response(user_question, results, show_actual)
        else:
            return self._format_general_response(user_question, results, show_actual)
    
    def _format_empty_response(self, user_question: str) -> str:
        """Format response when no results found"""
        return "I couldn't find any data matching your query. Try rephrasing your question or checking if the data exists in the database."
    
    def _format_ranking_response(
        self,
        user_question: str,
        results: List[Dict[str, Any]],
        show_actual: bool = False
    ) -> str:
        """Format response for ranking/top N queries"""
        if not results:
            return "No results found."
        
        count = len(results)
        if count == 1:
            return f"Found 1 result."
        else:
            return f"Found {count} results."
    
    def _format_trend_response(
        self,
        user_question: str,
        results: List[Dict[str, Any]],
        show_actual: bool = False
    ) -> str:
        """Format response for trend/time series queries"""
        if not results:
            return "No trend data found."
        
        count = len(results)
        if count == 1:
            return f"Found 1 data point."
        else:
            return f"Found {count} data points showing the trend."
    
    def _format_count_response(
        self,
        user_question: str,
        results: List[Dict[str, Any]]
    ) -> str:
        """Format response for count queries"""
        if results and len(results) == 1:
            count = list(results[0].values())[0]
            return f"The answer is **{count:,}**."
        else:
            return self._format_general_response(user_question, results)
    
    def _format_ratio_response(
        self,
        user_question: str,
        results: List[Dict[str, Any]],
        show_actual: bool = False
    ) -> str:
        """Format response for ratio/percentage queries"""
        return self._format_ranking_response(user_question, results, show_actual)
    
    def _format_general_response(
        self,
        user_question: str,
        results: List[Dict[str, Any]],
        show_actual: bool = False
    ) -> str:
        """Format general response for other query types"""
        if not results:
            return "No results found."
        
        count = len(results)
        if count == 1:
            return f"Found 1 result."
        else:
            return f"Found {count} results."
