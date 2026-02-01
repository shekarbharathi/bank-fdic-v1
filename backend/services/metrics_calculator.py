"""
Financial metrics calculator for banking analysis
Calculates ratios, growth rates, and comparisons
"""
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class MetricsCalculator:
    """Calculate financial metrics from query results"""
    
    @staticmethod
    def calculate_capital_ratio(equity: float, assets: float) -> Optional[float]:
        """
        Calculate capital ratio (equity/assets)
        
        Args:
            equity: Total equity
            assets: Total assets
            
        Returns:
            Capital ratio as percentage, or None if invalid
        """
        if assets and assets > 0:
            return (equity / assets) * 100
        return None
    
    @staticmethod
    def calculate_growth_rate(current: float, previous: float) -> Optional[float]:
        """
        Calculate growth rate percentage
        
        Args:
            current: Current period value
            previous: Previous period value
            
        Returns:
            Growth rate as percentage, or None if invalid
        """
        if previous and previous > 0:
            return ((current - previous) / previous) * 100
        return None
    
    @staticmethod
    def calculate_roa(net_income: float, assets: float) -> Optional[float]:
        """
        Calculate Return on Assets (ROA)
        
        Args:
            net_income: Net income
            assets: Average assets
            
        Returns:
            ROA as percentage, or None if invalid
        """
        if assets and assets > 0:
            return (net_income / assets) * 100
        return None
    
    @staticmethod
    def calculate_efficiency_ratio(non_interest_expense: float, revenue: float) -> Optional[float]:
        """
        Calculate efficiency ratio (expenses/revenue)
        
        Args:
            non_interest_expense: Non-interest expenses
            revenue: Total revenue
            
        Returns:
            Efficiency ratio as percentage, or None if invalid
        """
        if revenue and revenue > 0:
            return (non_interest_expense / revenue) * 100
        return None
    
    @staticmethod
    def add_metrics_to_results(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Add calculated metrics to query results
        
        Args:
            results: Query results with financial data
            
        Returns:
            Results with added metric columns
        """
        enriched_results = []
        
        for row in results:
            enriched_row = row.copy()
            
            # Calculate capital ratio if equity and assets present
            if 'eqtot' in row and 'asset' in row:
                capital_ratio = MetricsCalculator.calculate_capital_ratio(
                    float(row['eqtot']) if row['eqtot'] else 0,
                    float(row['asset']) if row['asset'] else 0
                )
                if capital_ratio is not None:
                    enriched_row['capital_ratio'] = round(capital_ratio, 2)
            
            # Calculate ROA if net income and assets present
            if 'netinc' in row and 'asset' in row:
                roa = MetricsCalculator.calculate_roa(
                    float(row['netinc']) if row['netinc'] else 0,
                    float(row['asset']) if row['asset'] else 0
                )
                if roa is not None:
                    enriched_row['calculated_roa'] = round(roa, 2)
            
            enriched_results.append(enriched_row)
        
        return enriched_results
    
    @staticmethod
    def calculate_industry_average(results: List[Dict[str, Any]], metric: str) -> Optional[float]:
        """
        Calculate industry average for a metric
        
        Args:
            results: Query results
            metric: Metric column name
            
        Returns:
            Average value, or None if no valid data
        """
        values = []
        for row in results:
            val = row.get(metric)
            if val is not None and isinstance(val, (int, float)):
                values.append(float(val))
        
        if values:
            return sum(values) / len(values)
        return None
