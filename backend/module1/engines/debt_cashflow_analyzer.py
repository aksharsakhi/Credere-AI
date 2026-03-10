"""
Debt & Cash Flow Analyzer
==========================
Computes key financial ratios for financial health assessment:
  - Debt/Equity Ratio
  - Interest Coverage Ratio
  - Current Ratio
  - Profit Margin
  - Revenue Growth

Each ratio is benchmarked against industry standards and given
a health assessment (healthy / warning / critical).

Note: Module 1 only provides data extraction and ratio analysis.
Loan approval decisions are deferred to subsequent modules.
"""

import logging
from typing import Optional, List

from ..config import settings
from ..models.financial_data import (
    ExtractedFinancialData,
    FinancialRatio,
    FinancialRatiosReport,
    RatioHealth,
    TrendAnalysis,
)
from ..utils.financial_utils import (
    compute_debt_to_equity,
    compute_interest_coverage_ratio,
    compute_current_ratio,
    compute_profit_margin,
    compute_revenue_growth,
    assess_ratio_health,
    generate_ratio_interpretation,
)

logger = logging.getLogger(__name__)


class DebtCashFlowAnalyzer:
    """
    Analyzes financial data to compute key ratios for
    financial health assessment.
    """

    def __init__(self):
        self.benchmarks = settings.RATIO_BENCHMARKS

    def analyze(
        self,
        financial_data: ExtractedFinancialData,
        previous_year_data: Optional[ExtractedFinancialData] = None,
        trends: Optional[List[TrendAnalysis]] = None,
    ) -> FinancialRatiosReport:
        """
        Compute all financial ratios and generate a comprehensive report.

        Args:
            financial_data: Current year's extracted financial data
            previous_year_data: Previous year's data (for growth calculations)
            trends: Trend data from table parser (fallback for growth)

        Returns:
            FinancialRatiosReport with all ratios and recommendations
        """
        report = FinancialRatiosReport()

        # ── 1. Debt-to-Equity Ratio ─────────────────────────────────────
        de_value = compute_debt_to_equity(
            financial_data.total_debt, financial_data.equity
        )
        de_health = assess_ratio_health(
            de_value, self.benchmarks["debt_to_equity"], higher_is_better=False
        )
        report.debt_to_equity = FinancialRatio(
            ratio_name="Debt-to-Equity Ratio",
            value=de_value,
            health=RatioHealth(de_health) if de_health != "unknown" else RatioHealth.HEALTHY,
            benchmark_healthy=self.benchmarks["debt_to_equity"]["healthy"],
            benchmark_warning=self.benchmarks["debt_to_equity"]["warning"],
            benchmark_critical=self.benchmarks["debt_to_equity"]["critical"],
            interpretation=generate_ratio_interpretation("debt_to_equity", de_value, de_health),
            formula="Total Debt / Total Equity",
        )

        # ── 2. Interest Coverage Ratio ──────────────────────────────────
        icr_value = compute_interest_coverage_ratio(
            financial_data.ebit, financial_data.interest_expense
        )
        icr_health = assess_ratio_health(
            icr_value, self.benchmarks["interest_coverage"], higher_is_better=True
        )
        report.interest_coverage = FinancialRatio(
            ratio_name="Interest Coverage Ratio",
            value=icr_value,
            health=RatioHealth(icr_health) if icr_health != "unknown" else RatioHealth.HEALTHY,
            benchmark_healthy=self.benchmarks["interest_coverage"]["healthy"],
            benchmark_warning=self.benchmarks["interest_coverage"]["warning"],
            benchmark_critical=self.benchmarks["interest_coverage"]["critical"],
            interpretation=generate_ratio_interpretation("interest_coverage", icr_value, icr_health),
            formula="EBIT / Interest Expense",
        )

        # ── 3. Current Ratio ────────────────────────────────────────────
        cr_value = compute_current_ratio(
            financial_data.current_assets, financial_data.current_liabilities
        )
        cr_health = assess_ratio_health(
            cr_value, self.benchmarks["current_ratio"], higher_is_better=True
        )
        report.current_ratio = FinancialRatio(
            ratio_name="Current Ratio",
            value=cr_value,
            health=RatioHealth(cr_health) if cr_health != "unknown" else RatioHealth.HEALTHY,
            benchmark_healthy=self.benchmarks["current_ratio"]["healthy"],
            benchmark_warning=self.benchmarks["current_ratio"]["warning"],
            benchmark_critical=self.benchmarks["current_ratio"]["critical"],
            interpretation=generate_ratio_interpretation("current_ratio", cr_value, cr_health),
            formula="Current Assets / Current Liabilities",
        )

        # ── 4. Profit Margin ────────────────────────────────────────────
        pm_value = compute_profit_margin(
            financial_data.profit, financial_data.revenue
        )
        pm_health = assess_ratio_health(
            pm_value, self.benchmarks["profit_margin"], higher_is_better=True
        )
        report.profit_margin = FinancialRatio(
            ratio_name="Profit Margin",
            value=pm_value,
            health=RatioHealth(pm_health) if pm_health != "unknown" else RatioHealth.HEALTHY,
            benchmark_healthy=self.benchmarks["profit_margin"]["healthy"],
            benchmark_warning=self.benchmarks["profit_margin"]["warning"],
            benchmark_critical=self.benchmarks["profit_margin"]["critical"],
            interpretation=generate_ratio_interpretation("profit_margin", pm_value, pm_health),
            formula="Net Profit / Revenue",
        )

        # ── 5. Revenue Growth ───────────────────────────────────────────
        rg_value = None
        if previous_year_data and previous_year_data.revenue:
            rg_value = compute_revenue_growth(
                financial_data.revenue, previous_year_data.revenue
            )
        elif trends:
            # Try to get revenue growth from trends
            for trend in trends:
                if "revenue" in trend.metric_name.lower():
                    if trend.average_growth is not None:
                        rg_value = round(trend.average_growth / 100, 4)
                    break

        rg_health = assess_ratio_health(
            rg_value, self.benchmarks["revenue_growth"], higher_is_better=True
        )
        report.revenue_growth = FinancialRatio(
            ratio_name="Revenue Growth",
            value=rg_value,
            health=RatioHealth(rg_health) if rg_health != "unknown" else RatioHealth.HEALTHY,
            benchmark_healthy=self.benchmarks["revenue_growth"]["healthy"],
            benchmark_warning=self.benchmarks["revenue_growth"]["warning"],
            benchmark_critical=self.benchmarks["revenue_growth"]["critical"],
            interpretation=generate_ratio_interpretation("revenue_growth", rg_value, rg_health),
            formula="(Current Revenue - Previous Revenue) / Previous Revenue",
        )

        # ── Overall Health Assessment ───────────────────────────────────
        report.overall_health = self._compute_overall_health(report)
        report.financial_summary = self._generate_financial_summary(report)

        return report

    def _compute_overall_health(self, report: FinancialRatiosReport) -> RatioHealth:
        """Determine overall financial health from individual ratios."""
        ratios = [
            report.debt_to_equity,
            report.interest_coverage,
            report.current_ratio,
            report.profit_margin,
            report.revenue_growth,
        ]

        health_scores = {"healthy": 0, "warning": 0, "critical": 0}
        computed_count = 0

        for ratio in ratios:
            if ratio and ratio.value is not None:
                health_scores[ratio.health.value] += 1
                computed_count += 1

        if computed_count == 0:
            return RatioHealth.WARNING

        if health_scores["critical"] >= 2:
            return RatioHealth.CRITICAL
        elif health_scores["critical"] >= 1 or health_scores["warning"] >= 2:
            return RatioHealth.WARNING
        else:
            return RatioHealth.HEALTHY

    def _generate_financial_summary(self, report: FinancialRatiosReport) -> str:
        """Generate a neutral financial health summary. No approval/rejection — that's for later modules."""

        # Count what's computable vs missing
        all_ratios = [
            ("Debt-to-Equity", report.debt_to_equity),
            ("Interest Coverage", report.interest_coverage),
            ("Current Ratio", report.current_ratio),
            ("Profit Margin", report.profit_margin),
            ("Revenue Growth", report.revenue_growth),
        ]
        computed = [(n, r) for n, r in all_ratios if r and r.value is not None]
        missing = [(n, r) for n, r in all_ratios if not r or r.value is None]

        parts = []
        parts.append(f"📊 FINANCIAL HEALTH SUMMARY (Module 1 — Data Extraction)")
        parts.append(f"Computed {len(computed)} of {len(all_ratios)} key ratios.")

        if report.overall_health == RatioHealth.HEALTHY:
            parts.append("✅ Computed ratios indicate a strong financial position.")
        elif report.overall_health == RatioHealth.WARNING:
            concerns = []
            if report.debt_to_equity and report.debt_to_equity.health != RatioHealth.HEALTHY:
                concerns.append("high leverage")
            if report.interest_coverage and report.interest_coverage.health != RatioHealth.HEALTHY:
                concerns.append("weak debt servicing capacity")
            if report.current_ratio and report.current_ratio.health != RatioHealth.HEALTHY:
                concerns.append("low liquidity")
            if report.profit_margin and report.profit_margin.health != RatioHealth.HEALTHY:
                concerns.append("thin profitability")
            if report.revenue_growth and report.revenue_growth.health != RatioHealth.HEALTHY:
                concerns.append("stagnant revenue growth")
            concern_str = ", ".join(concerns) if concerns else "some areas"
            parts.append(f"⚠️ Areas of concern detected: {concern_str}.")
        else:
            parts.append("🚨 Multiple critical financial indicators detected. Further investigation required.")

        if missing:
            missing_names = [n for n, _ in missing]
            parts.append(f"ℹ️ Missing ratios: {', '.join(missing_names)} — upload additional documents to compute these.")

        parts.append("Note: Final assessment pending — additional modules (web scraping, external data) will contribute to the complete evaluation.")

        return " ".join(parts)
