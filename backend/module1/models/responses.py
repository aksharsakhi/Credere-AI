"""
API Response Models
Standardized response schemas for all Module 1 endpoints.
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from .financial_data import (
    ExtractedFinancialData,
    FinancialTable,
    TrendAnalysis,
    CrossVerificationAlert,
    FinancialRatiosReport,
    DataCompletenessReport,
    UploadedDocument,
)


class APIResponse(BaseModel):
    """Standard API response wrapper."""
    success: bool = True
    message: str = ""
    data: Optional[Any] = None
    errors: Optional[List[str]] = None


class DocumentUploadResponse(BaseModel):
    """Response after uploading a document."""
    success: bool = True
    message: str = ""
    document_id: str = ""
    filename: str = ""
    category: str = ""
    page_count: Optional[int] = None
    extraction_status: str = "pending"


class ExtractionResponse(BaseModel):
    """Response from the Understanding Engine extraction."""
    success: bool = True
    message: str = ""
    document_id: str = ""
    financial_data: Optional[ExtractedFinancialData] = None
    tables: List[FinancialTable] = []
    raw_text_preview: Optional[str] = None
    confidence_score: Optional[float] = None


class TrendAnalysisResponse(BaseModel):
    """Response from the Financial Table Parser trend analysis."""
    success: bool = True
    message: str = ""
    trends: List[TrendAnalysis] = []
    tables: List[FinancialTable] = []


class CrossVerificationResponse(BaseModel):
    """Response from GST-Bank Cross Verification."""
    success: bool = True
    message: str = ""
    alerts: List[CrossVerificationAlert] = []
    gst_revenue: Optional[float] = None
    bank_inflow: Optional[float] = None
    deviation_percentage: Optional[float] = None
    risk_summary: str = ""


class RatioAnalysisResponse(BaseModel):
    """Response from Debt & Cash Flow Analyzer."""
    success: bool = True
    message: str = ""
    ratios: Optional[FinancialRatiosReport] = None


class CompletenessResponse(BaseModel):
    """Response from data completeness check."""
    success: bool = True
    message: str = ""
    report: Optional[DataCompletenessReport] = None


class FullAnalysisResponse(BaseModel):
    """Complete Module 1 analysis combining all outputs."""
    success: bool = True
    message: str = ""
    company_name: Optional[str] = None
    documents_uploaded: List[str] = []
    completeness: Optional[DataCompletenessReport] = None
    consolidated_financials: Optional[ExtractedFinancialData] = None
    tables: List[FinancialTable] = []
    trends: List[TrendAnalysis] = []
    cross_verification: Optional[CrossVerificationResponse] = None
    financial_ratios: Optional[FinancialRatiosReport] = None
    risk_alerts: List[CrossVerificationAlert] = []
    overall_risk_level: str = "unknown"

