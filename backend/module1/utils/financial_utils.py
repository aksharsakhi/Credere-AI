"""
Financial Calculation Utilities
Helper functions for computing financial ratios and metrics.
"""

from typing import Optional, List, Dict
import logging

logger = logging.getLogger(__name__)


def compute_debt_to_equity(total_debt: Optional[float], equity: Optional[float]) -> Optional[float]:
    """
    Debt-to-Equity Ratio = Total Debt / Total Equity
    Lower is better. Indicates leverage level.
    """
    if total_debt is None or equity is None or equity == 0:
        return None
    return round(total_debt / equity, 2)


def compute_interest_coverage_ratio(ebit: Optional[float], interest_expense: Optional[float]) -> Optional[float]:
    """
    Interest Coverage Ratio = EBIT / Interest Expense
    Higher is better. Indicates ability to service debt.
    """
    if ebit is None or interest_expense is None or interest_expense == 0:
        return None
    return round(ebit / interest_expense, 2)


def compute_current_ratio(current_assets: Optional[float], current_liabilities: Optional[float]) -> Optional[float]:
    """
    Current Ratio = Current Assets / Current Liabilities
    > 1 means ability to pay short-term obligations.
    """
    if current_assets is None or current_liabilities is None or current_liabilities == 0:
        return None
    return round(current_assets / current_liabilities, 2)


def compute_profit_margin(profit: Optional[float], revenue: Optional[float]) -> Optional[float]:
    """
    Profit Margin = Net Profit / Revenue
    Higher is better. Indicates profitability.
    """
    if profit is None or revenue is None or revenue == 0:
        return None
    return round(profit / revenue, 4)


def compute_revenue_growth(
    current_revenue: Optional[float], previous_revenue: Optional[float]
) -> Optional[float]:
    """
    Revenue Growth = (Current - Previous) / Previous
    Indicates business growth trajectory.
    """
    if current_revenue is None or previous_revenue is None or previous_revenue == 0:
        return None
    return round((current_revenue - previous_revenue) / previous_revenue, 4)


def compute_gst_bank_deviation(
    gst_revenue: Optional[float], bank_inflow: Optional[float]
) -> Optional[float]:
    """
    Deviation = (GST Revenue - Bank Inflow) / GST Revenue
    High positive deviation may indicate circular trading.
    """
    if gst_revenue is None or bank_inflow is None or gst_revenue == 0:
        return None
    return round((gst_revenue - bank_inflow) / gst_revenue, 4)


def assess_ratio_health(value: Optional[float], benchmarks: Dict[str, float], higher_is_better: bool = True) -> str:
    """
    Assess the health of a financial ratio against benchmarks.
    Returns: 'healthy', 'warning', or 'critical'
    """
    if value is None:
        return "unknown"

    healthy = benchmarks.get("healthy", 0)
    warning = benchmarks.get("warning", 0)
    critical = benchmarks.get("critical", 0)

    if higher_is_better:
        if value >= healthy:
            return "healthy"
        elif value >= warning:
            return "warning"
        else:
            return "critical"
    else:
        # Lower is better (e.g., debt-to-equity)
        if value <= healthy:
            return "healthy"
        elif value <= warning:
            return "warning"
        else:
            return "critical"


def generate_ratio_interpretation(ratio_name: str, value: Optional[float], health: str) -> str:
    """Generate a human-readable interpretation of a financial ratio."""
    if value is None:
        return f"Cannot compute {ratio_name} — insufficient data."

    interpretations = {
        "debt_to_equity": {
            "healthy": f"Debt-to-Equity ratio of {value:.2f} indicates conservative leverage. The company is not over-leveraged.",
            "warning": f"Debt-to-Equity ratio of {value:.2f} is moderate. The company carries notable debt relative to equity.",
            "critical": f"Debt-to-Equity ratio of {value:.2f} is dangerously high. The company is heavily leveraged — high risk for loan default.",
        },
        "interest_coverage": {
            "healthy": f"Interest Coverage Ratio of {value:.2f}x shows strong ability to service debt interest payments.",
            "warning": f"Interest Coverage Ratio of {value:.2f}x is tight. Company may face difficulty if earnings decline.",
            "critical": f"Interest Coverage Ratio of {value:.2f}x is critically low. Company struggles to cover interest — high default risk.",
        },
        "current_ratio": {
            "healthy": f"Current Ratio of {value:.2f} indicates good short-term liquidity. Company can meet immediate obligations.",
            "warning": f"Current Ratio of {value:.2f} is tight. Short-term liquidity could become a concern.",
            "critical": f"Current Ratio of {value:.2f} signals potential liquidity crisis. Company may not be able to pay short-term debts.",
        },
        "profit_margin": {
            "healthy": f"Profit Margin of {value*100:.1f}% shows healthy profitability.",
            "warning": f"Profit Margin of {value*100:.1f}% is thin. Company has limited buffer against cost increases.",
            "critical": f"Profit Margin of {value*100:.1f}% is very low. Company is barely profitable — sustainability concern.",
        },
        "revenue_growth": {
            "healthy": f"Revenue Growth of {value*100:.1f}% indicates strong business momentum.",
            "warning": f"Revenue Growth of {value*100:.1f}% is flat. Business growth has stalled.",
            "critical": f"Revenue Growth of {value*100:.1f}% shows declining revenue — significant business risk.",
        },
    }

    ratio_interps = interpretations.get(ratio_name, {})
    return ratio_interps.get(health, f"{ratio_name}: {value:.2f} — {health}")
