"""Top-level risk engine for Module 3 credit intelligence."""

from __future__ import annotations

from typing import Any, Dict, List

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

from .cashflow_analysis import score_cashflow_stability
from .financial_ratios import score_financial_strength
from .industry_risk import score_industry_risk
from .legal_risk import score_legal_risk
from .operational_analysis import score_operational_observations
from .promoter_analysis import score_promoter_reputation


WEIGHTS: Dict[str, float] = {
    "financial_strength_score": 0.35,
    "cash_flow_score": 0.20,
    "legal_risk_score": 0.15,
    "industry_risk_score": 0.10,
    "promoter_score": 0.10,
    "operational_score": 0.10,
}


class FinancialDataInput(BaseModel):
    revenue: float = 0.0
    net_profit: float = 0.0
    total_debt: float = 0.0
    total_assets: float = 0.0
    equity: float = 0.0
    interest_expense: float = 0.0
    cash_flow: float = 0.0
    current_assets: float = 0.0
    current_liabilities: float = 0.0


class ExternalRiskInput(BaseModel):
    litigation_cases: int = 0
    negative_news_score: float = Field(0.0, ge=0.0, le=100.0)
    sector_risk_score: float = Field(50.0, ge=0.0, le=100.0)
    promoter_risk_score: float = Field(50.0, ge=0.0, le=100.0)


class OperationalInput(BaseModel):
    factory_utilization: float = Field(50.0, ge=0.0, le=100.0)
    management_rating: float = Field(50.0, ge=0.0, le=100.0)


class CreditRiskResponse(BaseModel):
    financial_strength_score: int
    cash_flow_score: int
    legal_risk_score: int
    industry_risk_score: int
    promoter_score: int
    operational_score: int
    final_risk_score: int
    risk_category: str
    explanation: List[str]
    contribution_breakdown: Dict[str, float]
    explainable_score_impact: List[Dict[str, Any]]
    intermediate_metrics: Dict[str, Dict[str, float | None]]


def _risk_category(score: int) -> str:
    if score >= 80:
        return "Low"
    if score >= 60:
        return "Medium"
    return "High"


def _clamp_0_100(value: float) -> int:
    return int(np.clip(round(value), 0, 100))


def _build_impact_table(raw_scores: Dict[str, int]) -> List[Dict[str, Any]]:
    rows = []
    for metric, score in raw_scores.items():
        weight = WEIGHTS[metric]
        weighted = round(score * weight, 2)
        rows.append(
            {
                "factor": metric,
                "raw_score": score,
                "weight": weight,
                "weighted_contribution": weighted,
            }
        )

    # Pandas is used for predictable ordering and serializable records.
    df = pd.DataFrame(rows)
    df = df.sort_values(
        "weighted_contribution", ascending=False
    ).reset_index(drop=True)
    return df.to_dict(orient="records")


def compute_credit_risk(
    financial_data: Dict[str, Any],
    external_risk_data: Dict[str, Any],
    operational_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Main Module 3 entrypoint.

    Returns a production-ready JSON-friendly object for API responses.
    """
    fin = FinancialDataInput(**financial_data)
    ext = ExternalRiskInput(**external_risk_data)
    ops = OperationalInput(**operational_data)

    financial_strength_score, fin_exp, fin_metrics = score_financial_strength(
        fin.model_dump()
    )
    cash_flow_score, cash_exp, cash_metrics = score_cashflow_stability(
        fin.model_dump()
    )
    legal_risk_score, legal_exp, legal_metrics = score_legal_risk(
        ext.model_dump()
    )
    industry_risk_score, industry_exp, industry_metrics = score_industry_risk(
        ext.model_dump()
    )
    promoter_score, promoter_exp, promoter_metrics = score_promoter_reputation(
        ext.model_dump()
    )
    operational_score, operational_exp, operational_metrics = (
        score_operational_observations(ops.model_dump())
    )

    raw_scores = {
        "financial_strength_score": financial_strength_score,
        "cash_flow_score": cash_flow_score,
        "legal_risk_score": legal_risk_score,
        "industry_risk_score": industry_risk_score,
        "promoter_score": promoter_score,
        "operational_score": operational_score,
    }

    weighted_final = sum(raw_scores[key] * WEIGHTS[key] for key in raw_scores)
    final_risk_score = _clamp_0_100(weighted_final)
    risk_category = _risk_category(final_risk_score)

    contributions = {
        k: round(raw_scores[k] * WEIGHTS[k], 2) for k in raw_scores
    }
    explanation = (
        fin_exp
        + cash_exp
        + legal_exp
        + industry_exp
        + promoter_exp
        + operational_exp
    )
    if not explanation:
        explanation = ["All factor blocks are within acceptable thresholds."]

    response = CreditRiskResponse(
        financial_strength_score=financial_strength_score,
        cash_flow_score=cash_flow_score,
        legal_risk_score=legal_risk_score,
        industry_risk_score=industry_risk_score,
        promoter_score=promoter_score,
        operational_score=operational_score,
        final_risk_score=final_risk_score,
        risk_category=risk_category,
        explanation=explanation,
        contribution_breakdown=contributions,
        explainable_score_impact=_build_impact_table(raw_scores),
        intermediate_metrics={
            "financial_metrics": fin_metrics,
            "cashflow_metrics": cash_metrics,
            "legal_metrics": legal_metrics,
            "industry_metrics": industry_metrics,
            "promoter_metrics": promoter_metrics,
            "operational_metrics": operational_metrics,
        },
    )
    return response.model_dump()


def simulate_revenue_drop(
    drop_percent: float,
    financial_data: Dict[str, Any],
    external_risk_data: Dict[str, Any],
    operational_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Stress scenario utility.

    Simulates a revenue drop and recalculates net profit/cash flow
    proportionally.
    """
    pct = float(np.clip(drop_percent, 0.0, 99.0))
    multiplier = (100.0 - pct) / 100.0

    stressed = dict(financial_data)
    stressed["revenue"] = (
        float(stressed.get("revenue", 0.0) or 0.0) * multiplier
    )
    stressed["net_profit"] = (
        float(stressed.get("net_profit", 0.0) or 0.0) * multiplier
    )
    stressed["cash_flow"] = (
        float(stressed.get("cash_flow", 0.0) or 0.0) * multiplier
    )

    result = compute_credit_risk(
        stressed, external_risk_data, operational_data
    )
    result["scenario"] = {
        "name": "revenue_drop",
        "drop_percent": round(pct, 2),
        "assumption": (
            "Revenue, net profit, and cash flow reduced proportionally."
        ),
    }
    return result


if __name__ == "__main__":
    # Example test input for local validation.
    example_financial_data = {
        "revenue": 250.0,
        "net_profit": 22.0,
        "total_debt": 120.0,
        "total_assets": 420.0,
        "equity": 150.0,
        "interest_expense": 9.0,
        "cash_flow": 30.0,
        "current_assets": 100.0,
        "current_liabilities": 70.0,
    }
    example_external_risk_data = {
        "litigation_cases": 3,
        "negative_news_score": 40.0,
        "sector_risk_score": 45.0,
        "promoter_risk_score": 35.0,
    }
    example_operational_data = {
        "factory_utilization": 72.0,
        "management_rating": 78.0,
    }

    base = compute_credit_risk(
        example_financial_data,
        example_external_risk_data,
        example_operational_data,
    )
    stress = simulate_revenue_drop(
        20.0,
        example_financial_data,
        example_external_risk_data,
        example_operational_data,
    )

    print("Base result:")
    print(base)
    print("\nStress result (20% revenue drop):")
    print(stress)
