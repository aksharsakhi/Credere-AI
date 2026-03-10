"""Financial ratio scoring for Module 3 credit intelligence."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np


def _safe_div(numerator: float, denominator: float) -> float | None:
    if denominator == 0:
        return None
    return numerator / denominator


def _clamp_0_100(value: float) -> int:
    return int(np.clip(round(value), 0, 100))


def score_financial_strength(
    financial_data: Dict[str, Any],
) -> Tuple[int, List[str], Dict[str, float | None]]:
    """
    Compute normalized financial strength score (0-100) from key ratios.

    Ratios:
    - Debt to Equity (lower is better)
    - Profit Margin (higher is better)
    - Interest Coverage Ratio (higher is better)
    - Current Ratio (healthy around >= 1.5)
    """
    total_debt = float(financial_data.get("total_debt", 0.0) or 0.0)
    equity = float(financial_data.get("equity", 0.0) or 0.0)
    net_profit = float(financial_data.get("net_profit", 0.0) or 0.0)
    revenue = float(financial_data.get("revenue", 0.0) or 0.0)
    interest_expense = float(
        financial_data.get("interest_expense", 0.0) or 0.0
    )
    ebit_proxy = net_profit + interest_expense
    current_assets = float(financial_data.get("current_assets", 0.0) or 0.0)
    current_liabilities = float(
        financial_data.get("current_liabilities", 0.0) or 0.0
    )

    debt_to_equity = _safe_div(total_debt, equity)
    profit_margin = _safe_div(net_profit, revenue)
    interest_coverage = _safe_div(ebit_proxy, interest_expense)
    current_ratio = _safe_div(current_assets, current_liabilities)

    explanations: List[str] = []

    # Debt to Equity scoring: <=1 excellent, 1-2 good, 2-3 weak, >3 risky.
    if debt_to_equity is None:
        de_score = 45.0
        explanations.append(
            "Debt to equity could not be computed (equity missing/zero)."
        )
    elif debt_to_equity <= 1.0:
        de_score = 95.0
        explanations.append(
            f"Debt to equity ratio is strong ({debt_to_equity:.2f})."
        )
    elif debt_to_equity <= 2.0:
        de_score = 80.0
        explanations.append(
            f"Debt to equity ratio is acceptable ({debt_to_equity:.2f})."
        )
    elif debt_to_equity <= 3.0:
        de_score = 60.0
        explanations.append(
            f"Debt to equity ratio is elevated ({debt_to_equity:.2f})."
        )
    else:
        de_score = 35.0
        explanations.append(
            f"Debt to equity ratio is high ({debt_to_equity:.2f})."
        )

    # Profit margin scoring: negative margins penalized heavily.
    if profit_margin is None:
        pm_score = 45.0
        explanations.append(
            "Profit margin could not be computed (revenue missing/zero)."
        )
    elif profit_margin >= 0.15:
        pm_score = 95.0
    elif profit_margin >= 0.10:
        pm_score = 85.0
    elif profit_margin >= 0.05:
        pm_score = 70.0
    elif profit_margin >= 0.00:
        pm_score = 55.0
    else:
        pm_score = 20.0
        explanations.append(
            "Net profit is negative, reducing financial strength."
        )

    # Interest coverage scoring: ability to service interest.
    if interest_coverage is None:
        icr_score = 40.0
        explanations.append(
            "Interest coverage could not be computed "
            "(interest expense missing/zero)."
        )
    elif interest_coverage >= 4.0:
        icr_score = 95.0
        explanations.append(
            f"Interest coverage is strong ({interest_coverage:.2f}x)."
        )
    elif interest_coverage >= 2.0:
        icr_score = 75.0
    elif interest_coverage >= 1.0:
        icr_score = 55.0
        explanations.append(
            f"Interest coverage is weak ({interest_coverage:.2f}x)."
        )
    else:
        icr_score = 25.0
        explanations.append(
            f"Interest coverage is critical ({interest_coverage:.2f}x)."
        )

    # Current ratio scoring: short-term liquidity quality.
    if current_ratio is None:
        cr_score = 45.0
        explanations.append(
            "Current ratio could not be computed "
            "(current liabilities missing/zero)."
        )
    elif current_ratio >= 1.5:
        cr_score = 90.0
    elif current_ratio >= 1.2:
        cr_score = 75.0
    elif current_ratio >= 1.0:
        cr_score = 60.0
    else:
        cr_score = 35.0
        explanations.append(
            "Current ratio indicates liquidity pressure "
            f"({current_ratio:.2f})."
        )

    # Weighted within financial block.
    block_score = (
        (de_score * 0.30)
        + (pm_score * 0.25)
        + (icr_score * 0.25)
        + (cr_score * 0.20)
    )

    metrics: Dict[str, float | None] = {
        "debt_to_equity_ratio": debt_to_equity,
        "profit_margin_ratio": profit_margin,
        "interest_coverage_ratio": interest_coverage,
        "current_ratio": current_ratio,
    }
    return _clamp_0_100(block_score), explanations, metrics
