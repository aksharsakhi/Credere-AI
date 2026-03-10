"""
GST-Bank Cross Verification Engine
====================================
Compares GST-reported revenue against actual bank account inflows
to detect potential circular trading, revenue inflation, or
shell company activity.

Key Logic:
  If GST Revenue >> Bank Deposits → Possible Circular Trading
  If Bank Deposits >> GST Revenue → Possible Under-Reporting (tax evasion)
"""

import logging
from typing import Optional, List

from ..config import settings
from ..models.financial_data import (
    CrossVerificationAlert,
    RiskLevel,
    ExtractedFinancialData,
)
from ..utils.financial_utils import compute_gst_bank_deviation

logger = logging.getLogger(__name__)


class GSTBankVerifier:
    """
    Cross-verifies GST filings against bank statements to detect
    financial discrepancies and potential fraud.
    """

    def __init__(self):
        self.deviation_threshold = settings.GST_BANK_DEVIATION_THRESHOLD
        self.circular_threshold = settings.CIRCULAR_TRADING_THRESHOLD

    def verify(
        self,
        gst_revenue: Optional[float],
        bank_inflow: Optional[float],
        revenue_from_financials: Optional[float] = None,
    ) -> List[CrossVerificationAlert]:
        """
        Run all cross-verification checks.

        Args:
            gst_revenue: Revenue as reported in GST filings (in Crores)
            bank_inflow: Total bank account inflow/credits (in Crores)
            revenue_from_financials: Revenue from annual report/financial statements

        Returns:
            List of alerts with severity levels
        """
        alerts: List[CrossVerificationAlert] = []

        # ── Check 1: GST vs Bank Inflow ─────────────────────────────────
        gst_bank_alert = self._check_gst_vs_bank(gst_revenue, bank_inflow)
        if gst_bank_alert:
            alerts.append(gst_bank_alert)

        # ── Check 2: GST vs Reported Revenue ────────────────────────────
        if revenue_from_financials and gst_revenue:
            gst_rev_alert = self._check_gst_vs_reported_revenue(
                gst_revenue, revenue_from_financials
            )
            if gst_rev_alert:
                alerts.append(gst_rev_alert)

        # ── Check 3: Bank Inflow vs Reported Revenue ────────────────────
        if revenue_from_financials and bank_inflow:
            bank_rev_alert = self._check_bank_vs_reported_revenue(
                bank_inflow, revenue_from_financials
            )
            if bank_rev_alert:
                alerts.append(bank_rev_alert)

        # ── If no data available ────────────────────────────────────────
        if gst_revenue is None and bank_inflow is None:
            alerts.append(CrossVerificationAlert(
                alert_type="missing_data",
                severity=RiskLevel.MEDIUM,
                description="Cannot perform GST-Bank cross verification — both GST filing and Bank Statement data are missing.",
                recommendation="Please upload GST filing and Bank Statement documents to enable cross-verification.",
            ))

        return alerts

    def _check_gst_vs_bank(
        self, gst_revenue: Optional[float], bank_inflow: Optional[float]
    ) -> Optional[CrossVerificationAlert]:
        """Check deviation between GST revenue and bank inflows."""

        if gst_revenue is None or bank_inflow is None:
            if gst_revenue is None and bank_inflow is not None:
                return CrossVerificationAlert(
                    alert_type="missing_gst_data",
                    severity=RiskLevel.MEDIUM,
                    gst_revenue=gst_revenue,
                    bank_inflow=bank_inflow,
                    description="GST filing data not available for cross-verification against bank inflows.",
                    recommendation="Upload GST filing document to enable complete cross-verification.",
                )
            if bank_inflow is None and gst_revenue is not None:
                return CrossVerificationAlert(
                    alert_type="missing_bank_data",
                    severity=RiskLevel.MEDIUM,
                    gst_revenue=gst_revenue,
                    bank_inflow=bank_inflow,
                    description="Bank statement data not available for cross-verification against GST.",
                    recommendation="Upload Bank Statement to enable complete cross-verification.",
                )
            return None

        deviation = compute_gst_bank_deviation(gst_revenue, bank_inflow)
        if deviation is None:
            return None

        abs_deviation = abs(deviation)
        deviation_pct = round(abs_deviation * 100, 1)

        # GST Revenue >> Bank Inflow → Possible circular trading
        if deviation > 0 and abs_deviation >= self.circular_threshold:
            return CrossVerificationAlert(
                alert_type="circular_trading_suspected",
                severity=RiskLevel.CRITICAL,
                gst_revenue=gst_revenue,
                bank_inflow=bank_inflow,
                deviation_percentage=deviation_pct,
                description=(
                    f"🚨 CRITICAL: GST Revenue (₹{gst_revenue:.1f} Cr) significantly exceeds "
                    f"Bank Inflow (₹{bank_inflow:.1f} Cr) by {deviation_pct}%. "
                    f"This pattern is a strong indicator of circular trading or revenue inflation."
                ),
                recommendation=(
                    "Immediately request detailed GST invoices and bank transaction records. "
                    "Cross-verify top customers/suppliers. Check for related-party transactions."
                ),
            )

        if deviation > 0 and abs_deviation >= self.deviation_threshold:
            return CrossVerificationAlert(
                alert_type="revenue_inflation_possible",
                severity=RiskLevel.HIGH,
                gst_revenue=gst_revenue,
                bank_inflow=bank_inflow,
                deviation_percentage=deviation_pct,
                description=(
                    f"⚠️ WARNING: GST Revenue (₹{gst_revenue:.1f} Cr) exceeds "
                    f"Bank Inflow (₹{bank_inflow:.1f} Cr) by {deviation_pct}%. "
                    f"Possible revenue inflation detected."
                ),
                recommendation=(
                    "Request detailed receivables aging report and "
                    "verify if outstanding GST invoices are genuine."
                ),
            )

        # Bank Inflow >> GST Revenue → Possible under-reporting
        if deviation < 0 and abs_deviation >= self.deviation_threshold:
            return CrossVerificationAlert(
                alert_type="under_reporting_possible",
                severity=RiskLevel.HIGH,
                gst_revenue=gst_revenue,
                bank_inflow=bank_inflow,
                deviation_percentage=deviation_pct,
                description=(
                    f"⚠️ WARNING: Bank Inflow (₹{bank_inflow:.1f} Cr) exceeds "
                    f"GST Revenue (₹{gst_revenue:.1f} Cr) by {deviation_pct}%. "
                    f"Possible GST under-reporting or tax evasion."
                ),
                recommendation=(
                    "Verify bank credits — some may be non-revenue items "
                    "(loans, capital infusion, inter-company transfers)."
                ),
            )

        # Within acceptable range
        return CrossVerificationAlert(
            alert_type="cross_verification_passed",
            severity=RiskLevel.LOW,
            gst_revenue=gst_revenue,
            bank_inflow=bank_inflow,
            deviation_percentage=deviation_pct,
            description=(
                f"✅ GST Revenue (₹{gst_revenue:.1f} Cr) and Bank Inflow (₹{bank_inflow:.1f} Cr) "
                f"are within acceptable tolerance ({deviation_pct}% deviation)."
            ),
            recommendation="No immediate action required. Proceed with analysis.",
        )

    def _check_gst_vs_reported_revenue(
        self, gst_revenue: float, reported_revenue: float
    ) -> Optional[CrossVerificationAlert]:
        """Check if GST revenue matches reported revenue in financials."""
        if reported_revenue == 0:
            return None

        deviation = abs(gst_revenue - reported_revenue) / reported_revenue
        deviation_pct = round(deviation * 100, 1)

        if deviation >= self.deviation_threshold:
            return CrossVerificationAlert(
                alert_type="gst_vs_reported_mismatch",
                severity=RiskLevel.HIGH,
                gst_revenue=gst_revenue,
                deviation_percentage=deviation_pct,
                description=(
                    f"GST Revenue (₹{gst_revenue:.1f} Cr) deviates from "
                    f"Reported Revenue (₹{reported_revenue:.1f} Cr) by {deviation_pct}%."
                ),
                recommendation="Investigate discrepancy — could indicate GST fraud or accounting errors.",
            )
        return None

    def _check_bank_vs_reported_revenue(
        self, bank_inflow: float, reported_revenue: float
    ) -> Optional[CrossVerificationAlert]:
        """Check bank inflow against reported revenue."""
        if reported_revenue == 0:
            return None

        deviation = abs(bank_inflow - reported_revenue) / reported_revenue
        deviation_pct = round(deviation * 100, 1)

        if deviation >= 0.50:  # 50% deviation is suspicious
            return CrossVerificationAlert(
                alert_type="bank_vs_reported_mismatch",
                severity=RiskLevel.MEDIUM,
                bank_inflow=bank_inflow,
                deviation_percentage=deviation_pct,
                description=(
                    f"Bank Inflow (₹{bank_inflow:.1f} Cr) deviates from "
                    f"Reported Revenue (₹{reported_revenue:.1f} Cr) by {deviation_pct}%."
                ),
                recommendation=(
                    "Note: Bank inflows may include non-revenue items. "
                    "Verify with detailed bank statement breakdown."
                ),
            )
        return None
