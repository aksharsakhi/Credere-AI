"""
PDF Processor Service
======================
High-level orchestrator that coordinates all engines to process
uploaded PDFs through the complete pipeline.
"""

import os
import uuid
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

from ..config import settings
from ..models.financial_data import (
    ExtractedFinancialData,
    FinancialTable,
    TrendAnalysis,
    CrossVerificationAlert,
    FinancialRatiosReport,
    DataCompletenessReport,
    UploadedDocument,
    DocumentCategory,
)
from ..models.responses import FullAnalysisResponse, CrossVerificationResponse
from ..engines.understanding_engine import UnderstandingEngine
from ..engines.table_parser import TableParser
from ..engines.gst_bank_verifier import GSTBankVerifier
from ..engines.debt_cashflow_analyzer import DebtCashFlowAnalyzer
from ..engines.document_validator import DocumentValidator

logger = logging.getLogger(__name__)


class PDFProcessorService:
    """
    Central service that manages all uploaded documents and
    orchestrates the full analysis pipeline.
    """

    def __init__(self):
        self.understanding_engine = UnderstandingEngine()
        self.table_parser = TableParser()
        self.gst_bank_verifier = GSTBankVerifier()
        self.debt_analyzer = DebtCashFlowAnalyzer()
        self.document_validator = DocumentValidator()

        # In-memory storage (use DB in production)
        self.documents: Dict[str, UploadedDocument] = {}
        self.extracted_data: Dict[str, ExtractedFinancialData] = {}
        self.extracted_tables: Dict[str, List[FinancialTable]] = {}

    # ── Document Management ─────────────────────────────────────────────

    async def upload_and_process(
        self, file_path: str, filename: str, category: str
    ) -> Dict[str, Any]:
        """
        Upload a document and run extraction.

        Returns:
            Document metadata, extracted data, and completeness report.
        """
        doc_id = str(uuid.uuid4())[:8]

        # Create document record
        doc = UploadedDocument(
            document_id=doc_id,
            filename=filename,
            category=DocumentCategory(category),
            upload_time=datetime.now(),
            file_path=file_path,
            extraction_status="processing",
        )
        self.documents[doc_id] = doc

        try:
            # Run understanding engine
            result = await self.understanding_engine.extract_from_pdf(
                file_path, category
            )

            doc.extracted_data = result["financial_data"]
            doc.tables = result["tables"]
            doc.page_count = result["page_count"]
            doc.extraction_status = "completed"

            # Store in working data
            self.extracted_data[doc_id] = result["financial_data"]
            self.extracted_tables[doc_id] = result["tables"]

            logger.info(f"Document {doc_id} processed successfully")

            return {
                "document_id": doc_id,
                "filename": filename,
                "category": category,
                "page_count": result["page_count"],
                "extraction_status": "completed",
                "financial_data": result["financial_data"],
                "tables": result["tables"],
                "raw_text_preview": result["raw_text"],
                "confidence_score": result["confidence_score"],
            }

        except Exception as e:
            doc.extraction_status = "failed"
            logger.error(f"Processing failed for {doc_id}: {e}")
            raise

    def get_all_documents(self) -> List[UploadedDocument]:
        """Get all uploaded documents."""
        return list(self.documents.values())

    def get_document(self, doc_id: str) -> Optional[UploadedDocument]:
        """Get a specific document by ID."""
        return self.documents.get(doc_id)

    def delete_document(self, doc_id: str) -> bool:
        """Delete a document and its data."""
        if doc_id in self.documents:
            doc = self.documents[doc_id]
            # Remove file
            if os.path.exists(doc.file_path):
                os.remove(doc.file_path)
            del self.documents[doc_id]
            self.extracted_data.pop(doc_id, None)
            self.extracted_tables.pop(doc_id, None)
            return True
        return False

    # ── Consolidated Data ───────────────────────────────────────────────

    def get_consolidated_financials(self) -> ExtractedFinancialData:
        """
        Merge financial data from all uploaded documents into one
        consolidated view. Priority: later uploads override earlier ones.
        """
        consolidated = ExtractedFinancialData()

        for doc_id, data in self.extracted_data.items():
            for field in data.model_fields:
                current = getattr(consolidated, field, None)
                new_val = getattr(data, field, None)
                if new_val is not None and (current is None):
                    setattr(consolidated, field, new_val)

        return consolidated

    def get_all_tables(self) -> List[FinancialTable]:
        """Get all extracted tables from all documents."""
        all_tables = []
        for tables in self.extracted_tables.values():
            all_tables.extend(tables)
        return all_tables

    def get_uploaded_categories(self) -> List[str]:
        """Get list of document categories that have been uploaded."""
        return list(set(
            doc.category.value for doc in self.documents.values()
        ))

    # ── Analysis Pipeline ───────────────────────────────────────────────

    def run_trend_analysis(self) -> List[TrendAnalysis]:
        """Run trend analysis on all extracted tables."""
        all_tables = self.get_all_tables()
        return self.table_parser.parse_tables_for_trends(all_tables)

    def run_cross_verification(self) -> CrossVerificationResponse:
        """Run GST-Bank cross-verification."""
        consolidated = self.get_consolidated_financials()
        alerts = self.gst_bank_verifier.verify(
            gst_revenue=consolidated.gst_revenue,
            bank_inflow=consolidated.bank_inflow,
            revenue_from_financials=consolidated.revenue,
        )

        # Determine risk summary
        risk_levels = [a.severity.value for a in alerts]
        if "critical" in risk_levels:
            risk_summary = "🚨 CRITICAL risk detected — immediate investigation required"
        elif "high" in risk_levels:
            risk_summary = "⚠️ HIGH risk — further verification needed"
        elif "medium" in risk_levels:
            risk_summary = "ℹ️ MEDIUM risk — some data gaps exist"
        else:
            risk_summary = "✅ LOW risk — cross-verification passed"

        deviation = None
        if consolidated.gst_revenue and consolidated.bank_inflow and consolidated.gst_revenue != 0:
            deviation = round(
                abs(consolidated.gst_revenue - consolidated.bank_inflow)
                / consolidated.gst_revenue * 100, 1
            )

        return CrossVerificationResponse(
            alerts=alerts,
            gst_revenue=consolidated.gst_revenue,
            bank_inflow=consolidated.bank_inflow,
            deviation_percentage=deviation,
            risk_summary=risk_summary,
        )

    def run_ratio_analysis(self) -> FinancialRatiosReport:
        """Run financial ratio analysis."""
        consolidated = self.get_consolidated_financials()
        trends = self.run_trend_analysis()
        return self.debt_analyzer.analyze(consolidated, trends=trends)

    def check_completeness(self) -> DataCompletenessReport:
        """Check data completeness and generate suggestions."""
        uploaded_cats = self.get_uploaded_categories()
        consolidated = self.get_consolidated_financials()
        return self.document_validator.check_completeness(
            uploaded_cats, consolidated
        )

    # ── Full Analysis ───────────────────────────────────────────────────

    async def run_full_analysis(self) -> FullAnalysisResponse:
        """
        Run the complete Module 1 analysis pipeline.
        Returns a comprehensive report combining all components.
        """
        consolidated = self.get_consolidated_financials()
        completeness = self.check_completeness()
        trends = self.run_trend_analysis()
        cross_verification = self.run_cross_verification()
        ratios = self.run_ratio_analysis()

        # Compute overall risk level (observations only — no approval decision)
        risk_factors = []
        if ratios.overall_health:
            risk_factors.append(ratios.overall_health.value)
        for alert in cross_verification.alerts:
            risk_factors.append(alert.severity.value)

        if "critical" in risk_factors:
            overall_risk = "critical"
        elif "high" in risk_factors or risk_factors.count("warning") >= 2:
            overall_risk = "high"
        elif "warning" in risk_factors:
            overall_risk = "medium"
        else:
            overall_risk = "low"

        return FullAnalysisResponse(
            success=True,
            message="Full analysis completed",
            company_name=consolidated.company_name,
            documents_uploaded=self.get_uploaded_categories(),
            completeness=completeness,
            consolidated_financials=consolidated,
            tables=self.get_all_tables(),
            trends=trends,
            cross_verification=cross_verification,
            financial_ratios=ratios,
            risk_alerts=cross_verification.alerts,
            overall_risk_level=overall_risk,
        )

    def reset(self):
        """Reset all data (for testing)."""
        # Clean up uploaded files
        for doc in self.documents.values():
            if os.path.exists(doc.file_path):
                os.remove(doc.file_path)
        self.documents.clear()
        self.extracted_data.clear()
        self.extracted_tables.clear()

