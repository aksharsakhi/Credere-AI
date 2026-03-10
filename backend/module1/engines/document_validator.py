"""
Document Validator
==================
Tracks uploaded documents, identifies missing data fields, and
proactively suggests which documents the user should provide
for a complete financial analysis.
"""

import logging
from typing import Dict, List, Set, Optional

from ..config import settings
from ..models.financial_data import (
    ExtractedFinancialData,
    MissingDataField,
    DataCompletenessReport,
    RiskLevel,
)

logger = logging.getLogger(__name__)

# Display names for fields
FIELD_DISPLAY_NAMES = {
    "revenue": "Revenue",
    "profit": "Net Profit",
    "total_debt": "Total Debt",
    "total_assets": "Total Assets",
    "total_liabilities": "Total Liabilities",
    "cash_flow": "Cash Flow from Operations",
    "equity": "Shareholders' Equity / Net Worth",
    "interest_expense": "Interest Expense",
    "ebit": "EBIT (Earnings Before Interest & Tax)",
    "current_assets": "Current Assets",
    "current_liabilities": "Current Liabilities",
    "gst_revenue": "GST Revenue (Taxable Turnover)",
    "bank_inflow": "Bank Inflow (Total Credits)",
    "bank_outflow": "Bank Outflow (Total Debits)",
}

# What each field is needed for
FIELD_PURPOSE = {
    "revenue": "Revenue calculation and growth analysis",
    "profit": "Profitability assessment and profit margin computation",
    "total_debt": "Debt-to-Equity ratio and leverage analysis",
    "total_assets": "Asset base evaluation",
    "total_liabilities": "Liability assessment",
    "cash_flow": "Cash flow adequacy and repayment capacity",
    "equity": "Debt-to-Equity ratio computation",
    "interest_expense": "Interest Coverage Ratio computation",
    "ebit": "Interest Coverage Ratio and operational efficiency",
    "current_assets": "Current Ratio (short-term liquidity) computation",
    "current_liabilities": "Current Ratio (short-term liquidity) computation",
    "gst_revenue": "GST-Bank Cross Verification for fraud detection",
    "bank_inflow": "GST-Bank Cross Verification and cash flow validation",
    "bank_outflow": "Operating expenditure verification",
}

# Priority of missing fields (for loan approval)
FIELD_PRIORITY = {
    "revenue": RiskLevel.CRITICAL,
    "profit": RiskLevel.CRITICAL,
    "total_debt": RiskLevel.CRITICAL,
    "equity": RiskLevel.CRITICAL,
    "ebit": RiskLevel.HIGH,
    "interest_expense": RiskLevel.HIGH,
    "current_assets": RiskLevel.HIGH,
    "current_liabilities": RiskLevel.HIGH,
    "total_assets": RiskLevel.HIGH,
    "total_liabilities": RiskLevel.HIGH,
    "cash_flow": RiskLevel.HIGH,
    "gst_revenue": RiskLevel.MEDIUM,
    "bank_inflow": RiskLevel.MEDIUM,
    "bank_outflow": RiskLevel.LOW,
}


class DocumentValidator:
    """
    Validates data completeness and suggests missing documents.
    Ensures the system proactively requests required information.
    """

    def __init__(self):
        self.required_fields = settings.REQUIRED_FINANCIAL_FIELDS
        self.document_categories = settings.DOCUMENT_CATEGORIES

    def check_completeness(
        self,
        uploaded_categories: List[str],
        consolidated_data: ExtractedFinancialData,
    ) -> DataCompletenessReport:
        """
        Check what data is available, what's missing, and what
        documents should be requested.
        """
        report = DataCompletenessReport()
        report.uploaded_documents = uploaded_categories

        # Determine missing document categories
        all_categories = set(self.document_categories.keys())
        uploaded_set = set(uploaded_categories)
        report.missing_documents = sorted(list(all_categories - uploaded_set))

        # Check each required field
        available: List[str] = []
        missing: List[MissingDataField] = []

        for field_name, field_config in self.required_fields.items():
            value = getattr(consolidated_data, field_name, None)
            if value is not None:
                available.append(field_name)
            else:
                # Determine which documents could supply this field
                source_docs = field_config.get("source_docs", [])
                # Filter to only suggest documents not yet uploaded
                needed_docs = [
                    self.document_categories.get(doc, doc)
                    for doc in source_docs
                    if doc not in uploaded_set
                ]

                suggestion = self._generate_suggestion(field_name, needed_docs, uploaded_set)

                missing.append(MissingDataField(
                    field_name=field_name,
                    display_name=FIELD_DISPLAY_NAMES.get(field_name, field_name),
                    required_documents=[
                        self.document_categories.get(d, d) for d in source_docs
                    ],
                    suggestion=suggestion,
                    priority=FIELD_PRIORITY.get(field_name, RiskLevel.MEDIUM),
                ))

        report.available_fields = available
        report.missing_fields = missing

        # Compute completeness percentage
        total_fields = len(self.required_fields)
        report.completeness_percentage = round(
            len(available) / total_fields * 100, 1
        ) if total_fields > 0 else 0.0

        # Determine if we can proceed with analysis
        # Need at minimum: revenue, profit, total_debt, equity
        critical_fields = {"revenue", "profit", "total_debt", "equity"}
        available_set = set(available)
        report.can_proceed_with_analysis = critical_fields.issubset(available_set)

        # Generate overall suggestions
        report.suggestions = self._generate_overall_suggestions(
            report, uploaded_set
        )

        return report

    def _generate_suggestion(
        self,
        field_name: str,
        needed_docs: List[str],
        uploaded_set: Set[str],
    ) -> str:
        """Generate a specific suggestion for a missing field."""
        purpose = FIELD_PURPOSE.get(field_name, "financial analysis")

        if needed_docs:
            docs_str = " or ".join(needed_docs)
            return (
                f"Please upload {docs_str} to extract "
                f"'{FIELD_DISPLAY_NAMES.get(field_name, field_name)}'. "
                f"This is needed for: {purpose}."
            )
        else:
            # All source docs uploaded but field still missing — LLM didn't extract it
            return (
                f"'{FIELD_DISPLAY_NAMES.get(field_name, field_name)}' could not be "
                f"extracted from the uploaded documents. This is needed for: {purpose}. "
                f"Please provide this data manually or upload a clearer document."
            )

    def _generate_overall_suggestions(
        self,
        report: DataCompletenessReport,
        uploaded_set: Set[str],
    ) -> List[str]:
        """Generate prioritized overall suggestions."""
        suggestions = []

        if report.completeness_percentage == 100:
            suggestions.append("✅ All required financial data is available. Full analysis can be performed.")
            return suggestions

        # Group missing fields by priority
        critical_missing = [f for f in report.missing_fields if f.priority == RiskLevel.CRITICAL]
        high_missing = [f for f in report.missing_fields if f.priority == RiskLevel.HIGH]
        medium_missing = [f for f in report.missing_fields if f.priority == RiskLevel.MEDIUM]

        if critical_missing:
            fields_str = ", ".join([f.display_name for f in critical_missing])
            suggestions.append(
                f"🚨 CRITICAL: The following essential fields are missing: {fields_str}. "
                f"Loan analysis cannot be completed without these."
            )

        if high_missing:
            fields_str = ", ".join([f.display_name for f in high_missing])
            suggestions.append(
                f"⚠️ IMPORTANT: Missing fields that affect ratio calculations: {fields_str}."
            )

        # Suggest specific documents to upload
        if "annual_report" not in uploaded_set and "financial_statement" not in uploaded_set:
            suggestions.append(
                "📄 Upload an Annual Report or Financial Statement — this is the primary "
                "source for most financial data points."
            )

        if "gst_filing" not in uploaded_set:
            suggestions.append(
                "📄 Upload GST Filing — required for revenue cross-verification and fraud detection."
            )

        if "bank_statement" not in uploaded_set:
            suggestions.append(
                "📄 Upload Bank Statement — required for cash flow verification and GST cross-checking."
            )

        if report.completeness_percentage < 50:
            suggestions.append(
                f"📊 Data completeness is only {report.completeness_percentage}%. "
                f"At least 4 critical fields (Revenue, Profit, Debt, Equity) "
                f"are needed for basic loan analysis."
            )

        return suggestions
