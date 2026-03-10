# Module 3 - Financial Intelligence Engine

## Entry Points

- `compute_credit_risk(financial_data, external_risk_data, operational_data)`
- `simulate_revenue_drop(drop_percent, financial_data, external_risk_data, operational_data)`

## FastAPI Integration

Router file: `backend/module3/main.py`

```python
from module3.main import router as module3_router
app.include_router(module3_router)
```

## Example Input

```json
{
  "financial_data": {
    "revenue": 250.0,
    "net_profit": 22.0,
    "total_debt": 120.0,
    "total_assets": 420.0,
    "equity": 150.0,
    "interest_expense": 9.0,
    "cash_flow": 30.0,
    "current_assets": 100.0,
    "current_liabilities": 70.0
  },
  "external_risk_data": {
    "litigation_cases": 3,
    "negative_news_score": 40.0,
    "sector_risk_score": 45.0,
    "promoter_risk_score": 35.0
  },
  "operational_data": {
    "factory_utilization": 72.0,
    "management_rating": 78.0
  }
}
```

## Example Output Shape

```json
{
  "financial_strength_score": 74,
  "cash_flow_score": 68,
  "legal_risk_score": 57,
  "industry_risk_score": 55,
  "promoter_score": 65,
  "operational_score": 75,
  "final_risk_score": 67,
  "risk_category": "Medium",
  "explanation": [
    "Debt to equity ratio is elevated (2.10).",
    "Interest coverage is weak (1.40x).",
    "3 litigation case(s) detected.",
    "Industry sector risk is moderate."
  ],
  "contribution_breakdown": {
    "financial_strength_score": 25.9,
    "cash_flow_score": 13.6,
    "legal_risk_score": 8.55,
    "industry_risk_score": 5.5,
    "promoter_score": 6.5,
    "operational_score": 7.5
  },
  "explainable_score_impact": [],
  "intermediate_metrics": {}
}
```
