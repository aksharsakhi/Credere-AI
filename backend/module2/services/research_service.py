"""
Research Orchestrator Service
==============================
Coordinates the research engine and processes results
into structured ResearchResult objects.
"""

import logging
from datetime import datetime
from typing import Optional

from ..engines.research_engine import ResearchEngine
from ..models.research_data import (
    ResearchInput,
    ResearchResult,
    CompanyProfile,
    NewsItem,
    LitigationRecord,
    DirectorInfo,
    OtherDirectorship,
    ComplianceStatus,
    CorporateRegistry,
    IndustryAnalysis,
    NetworkEntity,
    RiskSignal,
    RiskScores,
    RiskSummary,
    FinancialMetrics,
)

logger = logging.getLogger(__name__)


class ResearchService:
    """Orchestrates the full Module 2 research pipeline."""

    def __init__(self):
        self.engine = ResearchEngine()
        self._last_result: Optional[ResearchResult] = None

    @property
    def is_ready(self) -> bool:
        return self.engine.is_ready

    async def run_research(self, inp: ResearchInput) -> ResearchResult:
        """
        Execute full research pipeline:
        1. Send to Gemini research engine
        2. Parse raw response into structured models
        3. Generate alerts from risk signals
        4. Return complete ResearchResult
        """
        raw = await self.engine.research_company(
            company_name=inp.company_name,
            promoters=inp.promoters,
            directors=inp.directors,
            industry=inp.industry,
            location=inp.location,
            manual_observations=inp.manual_observations,
            financial_context=inp.financial_context,
        )

        result = self._build_result(inp.company_name, raw)
        self._last_result = result
        return result

    def get_last_result(self) -> Optional[ResearchResult]:
        return self._last_result

    def reset(self):
        self._last_result = None

    async def search_company_online(self, company_name: str) -> dict:
        """Get quick company details for Module 2 form prefill."""
        return await self.engine.search_company_online(company_name)

    # ── Result Builder ──────────────────────────────────────────────────

    def _build_result(self, company_name: str, raw: dict) -> ResearchResult:
        """Convert raw Gemini JSON into typed ResearchResult."""
        result = ResearchResult(
            company_name=company_name,
            research_timestamp=datetime.now().isoformat(),
        )

        # Company Profile
        cp = raw.get("company_profile", {})
        if cp:
            result.company_profile = CompanyProfile(**{
                k: cp.get(k, v.default if hasattr(v, 'default') else "")
                for k, v in CompanyProfile.model_fields.items()
            })

        # News Intelligence
        for item in raw.get("news_intelligence", []):
            try:
                result.news_intelligence.append(NewsItem(**item))
            except Exception:
                result.news_intelligence.append(NewsItem(
                    headline=str(item.get("headline", "")),
                    summary=str(item.get("summary", "")),
                    sentiment=str(item.get("sentiment", "neutral")),
                    impact=str(item.get("impact", "low")),
                ))

        # Litigation Records
        for item in raw.get("litigation_records", []):
            try:
                result.litigation_records.append(LitigationRecord(**item))
            except Exception:
                result.litigation_records.append(LitigationRecord(
                    case_type=str(item.get("case_type", "")),
                    summary=str(item.get("summary", "")),
                    severity=str(item.get("severity", "medium")),
                ))

        # Corporate Registry
        cr = raw.get("corporate_registry", {})
        if cr:
            directors = []
            for d in cr.get("directors", []):
                other_dirs = []
                for od in d.get("other_directorships", []):
                    other_dirs.append(OtherDirectorship(
                        company_name=str(od.get("company_name", "")),
                        status=str(od.get("status", "active")),
                        role=str(od.get("role", "")),
                    ))
                directors.append(DirectorInfo(
                    name=str(d.get("name", "")),
                    din=str(d.get("din", "")),
                    designation=str(d.get("designation", "")),
                    appointment_date=str(d.get("appointment_date", "")),
                    other_directorships=other_dirs,
                ))

            comp_status = None
            cs = cr.get("compliance_status", {})
            if cs:
                comp_status = ComplianceStatus(
                    annual_returns_filed=bool(
                        cs.get("annual_returns_filed", True)
                    ),
                    financial_statements_filed=bool(
                        cs.get("financial_statements_filed", True)
                    ),
                    any_defaults=bool(cs.get("any_defaults", False)),
                    notes=str(cs.get("notes", "")),
                )

            result.corporate_registry = CorporateRegistry(
                registration_number=str(cr.get("registration_number", "")),
                date_of_incorporation=str(cr.get("date_of_incorporation", "")),
                registered_address=str(cr.get("registered_address", "")),
                authorized_capital=str(cr.get("authorized_capital", "")),
                paid_up_capital=str(cr.get("paid_up_capital", "")),
                company_status=str(cr.get("company_status", "active")),
                directors=directors,
                compliance_status=comp_status,
            )

        # Industry Analysis
        ia = raw.get("industry_analysis", {})
        if ia:
            result.industry_analysis = IndustryAnalysis(
                sector=str(ia.get("sector", "")),
                growth_rate=str(ia.get("growth_rate", "")),
                market_size=str(ia.get("market_size", "")),
                key_trends=list(ia.get("key_trends", [])),
                regulatory_environment=str(
                    ia.get("regulatory_environment", "")
                ),
                risks=list(ia.get("risks", [])),
                opportunities=list(ia.get("opportunities", [])),
                outlook=str(ia.get("outlook", "stable")),
            )

        # Promoter Network
        for item in raw.get("promoter_network", []):
            try:
                result.promoter_network.append(NetworkEntity(**item))
            except Exception:
                result.promoter_network.append(NetworkEntity(
                    entity_name=str(item.get("entity_name", "")),
                    relationship=str(item.get("relationship", "")),
                    risk_flag=bool(item.get("risk_flag", False)),
                ))

        # Risk Signals
        for item in raw.get("risk_signals", []):
            try:
                result.risk_signals.append(RiskSignal(**item))
            except Exception:
                result.risk_signals.append(RiskSignal(
                    signal=str(item.get("signal", "")),
                    category=str(item.get("category", "financial")),
                    severity=str(item.get("severity", "medium")),
                ))

        # Risk Scores
        rs = raw.get("risk_scores", {})
        if rs:
            result.risk_scores = RiskScores(
                news_risk=int(rs.get("news_risk", 0)),
                legal_risk=int(rs.get("legal_risk", 0)),
                industry_risk=int(rs.get("industry_risk", 0)),
                promoter_risk=int(rs.get("promoter_risk", 0)),
                operational_risk=int(rs.get("operational_risk", 0)),
                overall_external_risk=int(rs.get("overall_external_risk", 0)),
            )

        # Risk Summary
        rsum = raw.get("risk_summary", {})
        if rsum:
            result.risk_summary = RiskSummary(
                news_risk_level=str(rsum.get("news_risk_level", "Low")),
                legal_risk_level=str(rsum.get("legal_risk_level", "Low")),
                industry_risk_level=str(
                    rsum.get("industry_risk_level", "Low")
                ),
                promoter_risk_level=str(
                    rsum.get("promoter_risk_level", "Low")
                ),
                operational_risk_level=str(
                    rsum.get("operational_risk_level", "Low")
                ),
                overall_assessment=str(rsum.get("overall_assessment", "")),
            )

        # Financial Metrics
        fm = raw.get("financial_metrics", {})
        if fm:
            def _opt_float(v):
                try:
                    return float(v) if v is not None else None
                except (ValueError, TypeError):
                    return None
            result.financial_metrics = FinancialMetrics(
                revenue_cr=_opt_float(fm.get("revenue_cr")),
                net_profit_cr=_opt_float(fm.get("net_profit_cr")),
                total_debt_cr=_opt_float(fm.get("total_debt_cr")),
                total_assets_cr=_opt_float(fm.get("total_assets_cr")),
                equity_cr=_opt_float(fm.get("equity_cr")),
                interest_expense_cr=_opt_float(fm.get("interest_expense_cr")),
                operating_cash_flow_cr=_opt_float(fm.get("operating_cash_flow_cr")),
                current_assets_cr=_opt_float(fm.get("current_assets_cr")),
                current_liabilities_cr=_opt_float(fm.get("current_liabilities_cr")),
                data_quality=str(fm.get("data_quality", "estimated")),
            )

        # Generate alerts from high-severity risk signals + litigation
        result.alerts = self._generate_alerts(result)

        return result

    # ── Alert Generation ────────────────────────────────────────────────

    @staticmethod
    def _generate_alerts(result: ResearchResult) -> list:
        """Extract top alerts from risk signals and litigation."""
        alerts = []

        for sig in result.risk_signals:
            if sig.severity in ("high", "critical"):
                alerts.append(f"⚠ {sig.signal}")

        for lit in result.litigation_records:
            if lit.severity in ("high", "critical"):
                amount = f" ({lit.claim_amount})" if lit.claim_amount else ""
                alerts.append(f"⚖ {lit.case_type}{amount} — {lit.status}")

        for entity in result.promoter_network:
            if entity.risk_flag:
                alerts.append(
                    f"🔗 {entity.entity_name} — {entity.details[:80]}"
                )

        # Industry risks
        if (
            result.industry_analysis
            and result.industry_analysis.outlook == "negative"
        ):
            alerts.append(
                "📉 Industry outlook negative for "
                f"{result.industry_analysis.sector}"
            )

        return alerts
