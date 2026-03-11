"""
Research Data Models
Pydantic schemas for Module 2 research intelligence.
"""

from pydantic import BaseModel, Field
from typing import Optional, List


# ---------------------------------------------------------------------------
# Input
# ---------------------------------------------------------------------------

class ResearchInput(BaseModel):
    """Input to the research engine."""
    company_name: str = Field(..., min_length=1)
    promoters: str = ""
    directors: str = ""
    industry: str = ""
    location: str = ""
    manual_observations: str = ""
    financial_context: str = ""


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------

class CompanyProfile(BaseModel):
    description: str = ""
    year_established: str = ""
    business_areas: List[str] = []
    employee_count_estimate: str = ""
    annual_revenue_estimate: str = ""


class NewsItem(BaseModel):
    headline: str = ""
    source: str = ""
    date: str = ""
    summary: str = ""
    sentiment: str = "neutral"
    impact: str = "low"
    risk_category: str = "financial"


class LitigationRecord(BaseModel):
    case_type: str = ""
    court: str = ""
    parties: str = ""
    claim_amount: str = ""
    status: str = "ongoing"
    date_filed: str = ""
    summary: str = ""
    severity: str = "medium"


class OtherDirectorship(BaseModel):
    company_name: str = ""
    status: str = "active"
    role: str = ""


class DirectorInfo(BaseModel):
    name: str = ""
    din: str = ""
    designation: str = ""
    appointment_date: str = ""
    other_directorships: List[OtherDirectorship] = []


class ComplianceStatus(BaseModel):
    annual_returns_filed: bool = True
    financial_statements_filed: bool = True
    any_defaults: bool = False
    notes: str = ""


class CorporateRegistry(BaseModel):
    registration_number: str = ""
    date_of_incorporation: str = ""
    registered_address: str = ""
    authorized_capital: str = ""
    paid_up_capital: str = ""
    company_status: str = "active"
    directors: List[DirectorInfo] = []
    compliance_status: Optional[ComplianceStatus] = None


class IndustryAnalysis(BaseModel):
    sector: str = ""
    growth_rate: str = ""
    market_size: str = ""
    key_trends: List[str] = []
    regulatory_environment: str = ""
    risks: List[str] = []
    opportunities: List[str] = []
    outlook: str = "stable"


class NetworkEntity(BaseModel):
    entity_name: str = ""
    entity_type: str = "company"
    relationship: str = ""
    connection_to: str = ""
    status: str = "active"
    risk_flag: bool = False
    details: str = ""


class RiskSignal(BaseModel):
    signal: str = ""
    category: str = "financial"
    severity: str = "medium"
    evidence: str = ""
    recommendation: str = ""


class FinancialMetrics(BaseModel):
    """Estimated financial metrics extracted by the research engine."""
    revenue_cr: Optional[float] = None
    net_profit_cr: Optional[float] = None
    total_debt_cr: Optional[float] = None
    total_assets_cr: Optional[float] = None
    equity_cr: Optional[float] = None
    interest_expense_cr: Optional[float] = None
    operating_cash_flow_cr: Optional[float] = None
    current_assets_cr: Optional[float] = None
    current_liabilities_cr: Optional[float] = None
    data_quality: str = "estimated"


class RiskScores(BaseModel):
    news_risk: int = 0
    legal_risk: int = 0
    industry_risk: int = 0
    promoter_risk: int = 0
    operational_risk: int = 0
    overall_external_risk: int = 0


class RiskSummary(BaseModel):
    news_risk_level: str = "Low"
    legal_risk_level: str = "Low"
    industry_risk_level: str = "Low"
    promoter_risk_level: str = "Low"
    operational_risk_level: str = "Low"
    overall_assessment: str = ""


# ---------------------------------------------------------------------------
# Full Research Result
# ---------------------------------------------------------------------------

class ResearchResult(BaseModel):
    """Complete Module 2 research output."""
    company_name: str = ""
    company_profile: Optional[CompanyProfile] = None
    news_intelligence: List[NewsItem] = []
    litigation_records: List[LitigationRecord] = []
    corporate_registry: Optional[CorporateRegistry] = None
    industry_analysis: Optional[IndustryAnalysis] = None
    promoter_network: List[NetworkEntity] = []
    risk_signals: List[RiskSignal] = []
    risk_scores: Optional[RiskScores] = None
    risk_summary: Optional[RiskSummary] = None
    financial_metrics: Optional[FinancialMetrics] = None
    alerts: List[str] = []
    research_timestamp: str = ""


# ---------------------------------------------------------------------------
# API Response
# ---------------------------------------------------------------------------

class ResearchResponse(BaseModel):
    """API response wrapper for Module 2."""
    success: bool = True
    message: str = ""
    data: Optional[ResearchResult] = None
    errors: Optional[List[str]] = None
