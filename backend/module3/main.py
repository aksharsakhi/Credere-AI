"""Module 3 API router for Financial Intelligence Engine."""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable

from fastapi import APIRouter
from pydantic import BaseModel

from .credit_engine.risk_engine import (
    compute_credit_risk,
    simulate_revenue_drop,
)


router = APIRouter(
    prefix="/api/module3",
    tags=["Module 3 - Financial Intelligence Engine"],
)


class CreditRiskRequest(BaseModel):
    financial_data: Dict[str, Any]
    external_risk_data: Dict[str, Any]
    operational_data: Dict[str, Any]


class StressTestRequest(CreditRiskRequest):
    drop_percent: float


def _canon_map(data: Dict[str, Any]) -> Dict[str, Any]:
    return {str(k).strip().lower(): v for k, v in data.items()}


def _pick(data: Dict[str, Any], keys: Iterable[str]) -> Any:
    cmap = _canon_map(data)
    for key in keys:
        if key in cmap and cmap[key] is not None:
            return cmap[key]
    return None


def _to_number(value: Any, default: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return default
        cleaned = re.sub(r"[^0-9.\-]", "", text)
        if cleaned in {"", "-", ".", "-."}:
            return default
        try:
            return float(cleaned)
        except ValueError:
            return default
    return default


def _to_int(value: Any, default: int = 0) -> int:
    return int(round(_to_number(value, float(default))))


def _normalize_financial(data: Dict[str, Any]) -> Dict[str, float]:
    bank_inflow = _to_number(_pick(data, ["bank_inflow", "bank inflow"]))
    bank_outflow = _to_number(_pick(data, ["bank_outflow", "bank outflow"]))
    inferred_cashflow = bank_inflow - bank_outflow

    return {
        "revenue": _to_number(
            _pick(data, ["revenue", "gst_revenue", "gst revenue", "turnover"])
        ),
        "net_profit": _to_number(
            _pick(data, ["net_profit", "profit", "pat", "ebit"])
        ),
        "total_debt": _to_number(
            _pick(
                data,
                [
                    "total_debt",
                    "total debt",
                    "borrowings",
                    "total_liabilities",
                ],
            )
        ),
        "total_assets": _to_number(
            _pick(data, ["total_assets", "total assets", "assets"])
        ),
        "equity": _to_number(
            _pick(
                data,
                ["equity", "shareholders_equity", "net_worth", "net worth"],
            )
        ),
        "interest_expense": _to_number(
            _pick(
                data,
                ["interest_expense", "interest expense", "finance_cost"],
            )
        ),
        "cash_flow": _to_number(
            _pick(data, ["cash_flow", "cash flow", "operating_cash_flow"]),
            inferred_cashflow,
        ),
        "current_assets": _to_number(
            _pick(data, ["current_assets", "current assets"])
        ),
        "current_liabilities": _to_number(
            _pick(data, ["current_liabilities", "current liabilities"])
        ),
    }


def _normalize_external(data: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "litigation_cases": _to_int(
            _pick(data, ["litigation_cases", "litigation cases", "cases"])
        ),
        "negative_news_score": _to_number(
            _pick(
                data,
                ["negative_news_score", "news_risk", "negative news score"],
            ),
            40.0,
        ),
        "sector_risk_score": _to_number(
            _pick(
                data,
                ["sector_risk_score", "industry_risk", "sector risk score"],
            ),
            50.0,
        ),
        "promoter_risk_score": _to_number(
            _pick(
                data,
                [
                    "promoter_risk_score",
                    "promoter_risk",
                    "promoter risk score",
                ],
            ),
            50.0,
        ),
    }


def _normalize_operational(data: Dict[str, Any]) -> Dict[str, float]:
    return {
        "factory_utilization": _to_number(
            _pick(
                data,
                [
                    "factory_utilization",
                    "factory utilization",
                    "capacity_utilization",
                ],
            ),
            70.0,
        ),
        "management_rating": _to_number(
            _pick(data, ["management_rating", "management rating"]),
            70.0,
        ),
    }


@router.post("/score")
async def score_credit_risk(payload: CreditRiskRequest):
    financial_data = _normalize_financial(payload.financial_data)
    external_data = _normalize_external(payload.external_risk_data)
    operational_data = _normalize_operational(payload.operational_data)

    result = compute_credit_risk(
        financial_data,
        external_data,
        operational_data,
    )
    return {
        "success": True,
        "message": "Module 3 risk score computed",
        "data": result,
        "normalized_inputs": {
            "financial_data": financial_data,
            "external_risk_data": external_data,
            "operational_data": operational_data,
        },
    }


@router.post("/stress/revenue-drop")
async def score_revenue_drop(payload: StressTestRequest):
    financial_data = _normalize_financial(payload.financial_data)
    external_data = _normalize_external(payload.external_risk_data)
    operational_data = _normalize_operational(payload.operational_data)

    result = simulate_revenue_drop(
        payload.drop_percent,
        financial_data,
        external_data,
        operational_data,
    )
    return {
        "success": True,
        "message": (
            "Stress simulation complete for revenue drop "
            f"{payload.drop_percent}%"
        ),
        "data": result,
    }


@router.get("/health")
async def module3_health():
    return {"status": "healthy", "module": "module3"}
