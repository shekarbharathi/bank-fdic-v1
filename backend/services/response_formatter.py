"""
Response formatter for converting query results to natural language
"""
from typing import List, Dict, Any, Optional
import logging

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
        
        # Detect question type and format accordingly
        question_lower = user_question.lower()
        
        if any(word in question_lower for word in ['top', 'best', 'highest', 'largest']):
            return self._format_ranking_response(user_question, results)
        elif any(word in question_lower for word in ['trend', 'growth', 'over time', 'history']):
            return self._format_trend_response(user_question, results)
        elif any(word in question_lower for word in ['count', 'how many', 'number']):
            return self._format_count_response(user_question, results)
        elif 'ratio' in question_lower or 'capital' in question_lower:
            return self._format_ratio_response(user_question, results)
        else:
            return self._format_general_response(user_question, results)
    
    def _format_empty_response(self, user_question: str) -> str:
        """Format response when no results found"""
        return "I couldn't find any data matching your query. Try rephrasing your question or checking if the data exists in the database."
    
    def _format_ranking_response(
        self,
        user_question: str,
        results: List[Dict[str, Any]]
    ) -> str:
        """Format response for ranking/top N queries"""
        response = f"Here are the results:\n\n"
        
        # Format as table
        if results:
            # Get column names
            columns = list(results[0].keys())
            
            # Create header
            response += "| " + " | ".join(columns) + " |\n"
            response += "|" + "|".join(["---"] * len(columns)) + "|\n"
            
            # Add rows (limit to 20 for readability)
            for i, row in enumerate(results[:20]):
                values = []
                for col in columns:
                    val = row.get(col)
                    if val is None:
                        values.append("N/A")
                    elif isinstance(val, (int, float)):
                        # Format numbers
                        if abs(val) >= 1_000_000_000:
                            values.append(f"${val/1_000_000_000:.2f}B")
                        elif abs(val) >= 1_000_000:
                            values.append(f"${val/1_000_000:.2f}M")
                        elif abs(val) >= 1_000:
                            values.append(f"${val/1_000:.2f}K")
                        else:
                            values.append(f"${val:.2f}" if isinstance(val, float) else str(val))
                    else:
                        values.append(str(val))
                response += "| " + " | ".join(values) + " |\n"
            
            if len(results) > 20:
                response += f"\n(Showing top 20 of {len(results)} results)"
        
        return response
    
    def _format_trend_response(
        self,
        user_question: str,
        results: List[Dict[str, Any]]
    ) -> str:
        """Format response for trend/time series queries"""
        response = "Here's the trend data:\n\n"
        
        if results:
            # Find date column
            date_col = None
            for col in results[0].keys():
                if 'date' in col.lower() or 'repdte' in col.lower():
                    date_col = col
                    break
            
            # Format as table
            columns = list(results[0].keys())
            response += "| " + " | ".join(columns) + " |\n"
            response += "|" + "|".join(["---"] * len(columns)) + "|\n"
            
            for row in results[:30]:  # Limit for trends
                values = []
                for col in columns:
                    val = row.get(col)
                    if val is None:
                        values.append("N/A")
                    elif isinstance(val, (int, float)):
                        if abs(val) >= 1_000_000_000:
                            values.append(f"${val/1_000_000_000:.2f}B")
                        elif abs(val) >= 1_000_000:
                            values.append(f"${val/1_000_000:.2f}M")
                        else:
                            values.append(f"${val:.2f}" if isinstance(val, float) else str(val))
                    else:
                        values.append(str(val))
                response += "| " + " | ".join(values) + " |\n"
        
        return response
    
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
        results: List[Dict[str, Any]]
    ) -> str:
        """Format response for ratio/percentage queries"""
        return self._format_ranking_response(user_question, results)
    
    def _format_general_response(
        self,
        user_question: str,
        results: List[Dict[str, Any]]
    ) -> str:
        """Format general response for other query types"""
        response = "Here are the results:\n\n"
        
        if results:
            columns = list(results[0].keys())
            response += "| " + " | ".join(columns) + " |\n"
            response += "|" + "|".join(["---"] * len(columns)) + "|\n"
            
            for row in results[:50]:  # Limit general results
                values = []
                for col in columns:
                    val = row.get(col)
                    if val is None:
                        values.append("N/A")
                    elif isinstance(val, (int, float)):
                        if abs(val) >= 1_000_000_000:
                            values.append(f"${val/1_000_000_000:.2f}B")
                        elif abs(val) >= 1_000_000:
                            values.append(f"${val/1_000_000:.2f}M")
                        else:
                            values.append(f"${val:.2f}" if isinstance(val, float) else str(val))
                    else:
                        values.append(str(val))
                response += "| " + " | ".join(values) + " |\n"
            
            if len(results) > 50:
                response += f"\n(Showing 50 of {len(results)} results)"
        
        return response
