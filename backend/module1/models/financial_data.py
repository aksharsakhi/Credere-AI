"""
Financial Data Models
Enterprise-grade Pydantic schemas for financial data structures.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class DocumentCategory(str, Enum):
    ANNUAL_REPORT = "annual_report"
    FINANCIAL_STATEMENT = "financial_statement"
    BANK_STATEMENT = "bank_statement"
    GST_FILING = "gst_filing"
    RATING_REPORT = "rating_report"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RatioHealth(str, Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"


# ---------------------------------------------------------------------------
# Core Financial Data
# ---------------------------------------------------------------------------

class ExtractedFinancialData(BaseModel):
    """Core financial data points extracted from documents."""
    revenue: Optional[float] = Field(None, description="Total revenue in Crores")
    profit: Optional[float] = Field(None, description="Net profit in Crores")
    total_debt: Optional[float] = Field(None, description="Total debt in Crores")
    total_assets: Optional[float] = Field(None, description="Total assets in Crores")
    total_liabilities: Optional[float] = Field(None, description="Total liabilities in Crores")
    cash_flow: Optional[float] = Field(None, description="Operating cash flow in Crores")
    equity: Optional[float] = Field(None, description="Total equity / net worth in Crores")
    interest_expense: Optional[float] = Field(None, description="Interest expense in Crores")
    ebit: Optional[float] = Field(None, description="EBIT in Crores")
    current_assets: Optional[float] = Field(None, description="Current assets in Crores")
    current_liabilities: Optional[float] = Field(None, description="Current liabilities in Crores")
    gst_revenue: Optional[float] = Field(None, description="Revenue as per GST returns in Crores")
    bank_inflow: Optional[float] = Field(None, description="Total bank inflow in Crores")
    bank_outflow: Optional[float] = Field(None, description="Total bank outflow in Crores")
    fiscal_year: Optional[str] = Field(None, description="Fiscal year, e.g. 2023-24")
    company_name: Optional[str] = Field(None, description="Company name")
    source_document: Optional[str] = Field(None, description="Source document category")


class FinancialTableRow(BaseModel):
    """A single row from a financial table."""
    year: Optional[str] = None
    metric: Optional[str] = None
    value: Optional[float] = None
    unit: Optional[str] = "Cr"


class FinancialTable(BaseModel):
    """Parsed financial table with multiple rows."""
    table_name: str = ""
    headers: List[str] = []
    rows: List[Dict[str, Any]] = []
    source_page: Optional[int] = None


class TrendDataPoint(BaseModel):
    """A single point in a trend analysis."""
    year: str
    value: float
    growth_rate: Optional[float] = None  # y-o-y growth %


class TrendAnalysis(BaseModel):
    """Trend analysis for a financial metric."""
    metric_name: str
    data_points: List[TrendDataPoint] = []
    average_growth: Optional[float] = None
    trend_direction: Optional[str] = None  # "increasing", "decreasing", "stable"
    chart_base64: Optional[str] = None


# ---------------------------------------------------------------------------
# Cross-Verification
# ---------------------------------------------------------------------------

class CrossVerificationAlert(BaseModel):
    """Alert generated from GST-Bank cross-verification."""
    alert_type: str
    severity: RiskLevel = RiskLevel.LOW
    gst_revenue: Optional[float] = None
    bank_inflow: Optional[float] = None
    deviation_percentage: Optional[float] = None
    description: str = ""
    recommendation: str = ""


# ---------------------------------------------------------------------------
# Financial Ratios
# ---------------------------------------------------------------------------

class FinancialRatio(BaseModel):
    """Computed financial ratio with health assessment."""
    ratio_name: str
    value: Optional[float] = None
    health: RatioHealth = RatioHealth.HEALTHY
    benchmark_healthy: Optional[float] = None
    benchmark_warning: Optional[float] = None
    benchmark_critical: Optional[float] = None
    interpretation: str = ""
    formula: str = ""


class FinancialRatiosReport(BaseModel):
    """Complete financial ratios analysis."""
    debt_to_equity: Optional[FinancialRatio] = None
    interest_coverage: Optional[FinancialRatio] = None
    current_ratio: Optional[FinancialRatio] = None
    profit_margin: Optional[FinancialRatio] = None
    revenue_growth: Optional[FinancialRatio] = None
    overall_health: RatioHealth = RatioHealth.HEALTHY
    financial_summary: str = ""


# ---------------------------------------------------------------------------
# Document Validation
# ---------------------------------------------------------------------------

class MissingDataField(BaseModel):
    """A single missing data field with suggestions."""
    field_name: str
    display_name: str
    required_documents: List[str] = []
    suggestion: str = ""
    priority: RiskLevel = RiskLevel.MEDIUM


class DataCompletenessReport(BaseModel):
    """Report on data completeness and missing documents."""
    uploaded_documents: List[str] = []
    missing_documents: List[str] = []
    available_fields: List[str] = []
    missing_fields: List[MissingDataField] = []
    completeness_percentage: float = 0.0
    can_proceed_with_analysis: bool = False
    suggestions: List[str] = []


# ---------------------------------------------------------------------------
# Upload Tracking
# ---------------------------------------------------------------------------

class UploadedDocument(BaseModel):
    """Metadata for an uploaded document."""
    document_id: str
    filename: str
    category: DocumentCategory
    upload_time: datetime
    file_path: str
    page_count: Optional[int] = None
    extraction_status: str = "pending"  # pending, processing, completed, failed
    extracted_data: Optional[ExtractedFinancialData] = None
    tables: List[FinancialTable] = []
