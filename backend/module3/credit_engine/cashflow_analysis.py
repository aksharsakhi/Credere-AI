"""Cash flow stability scoring for Module 3 credit intelligence."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np


def _safe_div(numerator: float, denominator: float) -> float | None:
    if denominator == 0:
        return None
    return numerator / denominator


def _clamp_0_100(value: float) -> int:
    return int(np.clip(round(value), 0, 100))


def score_cashflow_stability(
    financial_data: Dict[str, Any],
) -> Tuple[int, List[str], Dict[str, float | None]]:
    """
    Evaluate debt repayment ability from operating cash flow, interest burden,
    and revenue consistency proxy.
    """
    cash_flow = float(financial_data.get("cash_flow", 0.0) or 0.0)
    total_debt = float(financial_data.get("total_debt", 0.0) or 0.0)
    interest_expense = float(
        financial_data.get("interest_expense", 0.0) or 0.0
    )
    revenue = float(financial_data.get("revenue", 0.0) or 0.0)
    net_profit = float(financial_data.get("net_profit", 0.0) or 0.0)

    cfo_to_debt = _safe_div(cash_flow, total_debt)
    cfo_to_interest = _safe_div(cash_flow, interest_expense)
    cashflow_margin = _safe_div(cash_flow, revenue)
    earnings_quality = (
        _safe_div(cash_flow, net_profit) if net_profit != 0 else None
    )

    explanations: List[str] = []

    # CFO / Debt: proxy for debt repayment horizon.
    if cfo_to_debt is None:
        debt_cover_score = 45.0
    elif cfo_to_debt >= 0.35:
        debt_cover_score = 95.0
    elif cfo_to_debt >= 0.20:
        debt_cover_score = 75.0
    elif cfo_to_debt >= 0.10:
        debt_cover_score = 55.0
    else:
        debt_cover_score = 30.0
        explanations.append(
            "Operating cash flow is low compared with total debt."
        )

    # CFO / Interest: near-term servicing resilience.
    if cfo_to_interest is None:
        interest_cover_score = 45.0
    elif cfo_to_interest >= 3.0:
        interest_cover_score = 95.0
    elif cfo_to_interest >= 1.5:
        interest_cover_score = 75.0
    elif cfo_to_interest >= 1.0:
        interest_cover_score = 60.0
    else:
        interest_cover_score = 30.0
        explanations.append(
            "Operating cash flow does not comfortably cover "
            "interest obligations."
        )

    # Revenue consistency proxy from cashflow margin.
    if cashflow_margin is None:
        consistency_score = 45.0
    elif cashflow_margin >= 0.12:
        consistency_score = 90.0
    elif cashflow_margin >= 0.06:
        consistency_score = 75.0
    elif cashflow_margin >= 0.02:
        consistency_score = 55.0
    else:
        consistency_score = 35.0
        explanations.append(
            "Cash generation versus revenue is weak, "
            "suggesting unstable cash conversion."
        )

    # Earnings quality adds small adjustment.
    earnings_adj = 0.0
    if earnings_quality is not None:
        if earnings_quality < 0.8:
            earnings_adj = -8.0
            explanations.append("Cash flow conversion from earnings is weak.")
        elif earnings_quality > 1.2:
            earnings_adj = 5.0

    block_score = (
        (debt_cover_score * 0.40)
        + (interest_cover_score * 0.35)
        + (consistency_score * 0.25)
        + earnings_adj
    )

    metrics: Dict[str, float | None] = {
        "cfo_to_debt": cfo_to_debt,
        "cfo_to_interest": cfo_to_interest,
        "cashflow_margin": cashflow_margin,
        "earnings_quality": earnings_quality,
    }
    return _clamp_0_100(block_score), explanations, metrics
