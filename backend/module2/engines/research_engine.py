"""
Research Engine
================
Gemini-powered credit intelligence engine that performs comprehensive
due diligence research on companies, promoters, and industries.
"""

# flake8: noqa
import json
import logging
import re
from typing import Dict, Any

import google.generativeai as genai

from ..config import module2_settings

logger = logging.getLogger(__name__)

# ── JSON Template for Gemini ────────────────────────────────────────────
JSON_TEMPLATE = """{
  "company_profile": {
    "description": "2-3 sentence company background",
    "year_established": "YYYY",
    "business_areas": ["area1", "area2"],
    "employee_count_estimate": "e.g. 500-1000",
    "annual_revenue_estimate": "e.g. ₹200-500 Cr"
  },
  "news_intelligence": [
    {
      "headline": "realistic news headline",
      "source": "Economic Times / Business Standard / LiveMint / Reuters",
      "date": "YYYY-MM-DD",
      "summary": "2-3 sentence summary of the news item",
      "sentiment": "positive|negative|neutral",
      "impact": "low|medium|high",
      "risk_category": "financial|regulatory|operational|reputational"
    }
  ],
  "litigation_records": [
    {
      "case_type": "e.g. supplier dispute, tax evasion, loan default, IP infringement",
      "court": "e.g. NCLT Mumbai, Delhi High Court, Consumer Forum",
      "parties": "Plaintiff vs Defendant",
      "claim_amount": "e.g. ₹2.3 Cr",
      "status": "ongoing|resolved|appealed",
      "date_filed": "YYYY-MM-DD",
      "summary": "2-3 sentence case summary",
      "severity": "low|medium|high|critical"
    }
  ],
  "corporate_registry": {
    "registration_number": "e.g. U12345MH2010PTC123456",
    "date_of_incorporation": "YYYY-MM-DD",
    "registered_address": "full address",
    "authorized_capital": "e.g. ₹10 Cr",
    "paid_up_capital": "e.g. ₹5 Cr",
    "company_status": "active|dormant|struck_off",
    "directors": [
      {
        "name": "Director Name",
        "din": "8-digit DIN",
        "designation": "Managing Director|Director|Independent Director",
        "appointment_date": "YYYY-MM-DD",
        "other_directorships": [
          {
            "company_name": "Other Company Name",
            "status": "active|defunct|struck_off|defaulted",
            "role": "Director|Managing Director"
          }
        ]
      }
    ],
    "compliance_status": {
      "annual_returns_filed": true,
      "financial_statements_filed": true,
      "any_defaults": false,
      "notes": "any compliance notes"
    }
  },
  "industry_analysis": {
    "sector": "specific sector name",
    "growth_rate": "e.g. +4.5% YoY",
    "market_size": "e.g. ₹5 Lakh Cr",
    "key_trends": ["trend1", "trend2", "trend3"],
    "regulatory_environment": "description of current regulatory landscape",
    "risks": ["risk1", "risk2", "risk3"],
    "opportunities": ["opportunity1", "opportunity2"],
    "outlook": "positive|stable|negative"
  },
  "promoter_network": [
    {
      "entity_name": "name of connected entity",
      "entity_type": "person|company",
      "relationship": "Director|Former Director|Promoter|Subsidiary|Associate|Investor",
      "connection_to": "which promoter/director this connects to",
      "status": "active|defunct|bankrupt|defaulted|under_investigation",
      "risk_flag": false,
      "details": "brief description of the connection and any concerns"
    }
  ],
  "risk_signals": [
    {
      "signal": "brief description of the risk signal",
      "category": "fraud|governance|financial|legal|operational|market",
      "severity": "low|medium|high|critical",
      "evidence": "what evidence supports this signal",
      "recommendation": "what action should be taken"
    }
  ],
  "risk_scores": {
    "news_risk": 0,
    "legal_risk": 0,
    "industry_risk": 0,
    "promoter_risk": 0,
    "operational_risk": 0,
    "overall_external_risk": 0
  },
  "risk_summary": {
    "news_risk_level": "Low|Moderate|High|Critical",
    "legal_risk_level": "Low|Moderate|High|Critical",
    "industry_risk_level": "Low|Moderate|High|Critical",
    "promoter_risk_level": "Low|Moderate|High|Critical",
    "operational_risk_level": "Low|Moderate|High|Critical",
    "overall_assessment": "3-4 sentence overall risk assessment"
  }
}"""


class ResearchEngine:
    """
    Gemini-powered credit intelligence engine.
    Simulates a human credit analyst performing background research.
    """

    def __init__(self):
        self._model = None
        if module2_settings.GEMINI_API_KEY:
            genai.configure(api_key=module2_settings.GEMINI_API_KEY)
            self._model = genai.GenerativeModel(module2_settings.GEMINI_MODEL)
        else:
            logger.warning("GEMINI_API_KEY not set — research engine disabled")

    @property
    def is_ready(self) -> bool:
        return self._model is not None

    # ── Main Research Method ────────────────────────────────────────────

    async def research_company(
        self,
        company_name: str,
        promoters: str = "",
        directors: str = "",
        industry: str = "",
        location: str = "",
        manual_observations: str = "",
        financial_context: str = "",
    ) -> Dict[str, Any]:
        """
        Run comprehensive credit intelligence research using Gemini.

        Returns:
            Parsed JSON dict with all research findings.
        """
        if not self.is_ready:
            raise RuntimeError(
              "Gemini API not configured. Set GEMINI_API_KEY."
            )

        prompt = self._build_prompt(
            company_name, promoters, directors,
            industry, location, manual_observations, financial_context,
        )

        logger.info(f"Starting research for: {company_name}")

        try:
            response = await self._model.generate_content_async(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=8192,
                ),
            )
            raw_text = response.text.strip()
            result = self._parse_json_response(raw_text)
            logger.info(f"Research completed for: {company_name}")
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON: {e}")
            raise RuntimeError(f"Research engine returned invalid data: {e}")
        except Exception as e:
            logger.error(f"Research engine error: {e}")
            raise

    async def search_company_online(self, company_name: str) -> Dict[str, Any]:
        """
        Quick online company lookup to prefill Module 2 input fields.

        Returns a compact JSON with best-effort details.
        """
        if not self.is_ready:
            raise RuntimeError(
              "Gemini API not configured. Set GEMINI_API_KEY."
            )

        prompt = f"""You are assisting a credit analyst.
      Based on public information,
  return a compact JSON object for the company below.

  Company: {company_name}

  Return ONLY valid JSON with this exact schema:
    {{
      "company_name": "string",
      "industry": "string",
      "location": "string",
      "promoters": ["name1", "name2"],
      "directors": ["name1", "name2"],
      "summary": "2-3 sentence company profile and major context"
    }}

- Rules:
- If uncertain, keep value as empty string or empty array.
- Do not include markdown or extra text.
    """

        try:
            response = await self._model.generate_content_async(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=1200,
                ),
            )
            raw_text = response.text.strip()
            parsed = self._parse_json_response(raw_text)
            return {
                "company_name": str(
                    parsed.get("company_name", company_name) or company_name
                ),
                "industry": str(parsed.get("industry", "") or ""),
                "location": str(parsed.get("location", "") or ""),
                "promoters": list(parsed.get("promoters", []) or []),
                "directors": list(parsed.get("directors", []) or []),
                "summary": str(parsed.get("summary", "") or ""),
            }
        except Exception as e:
            logger.error(f"Online company search failed: {e}")
            raise RuntimeError(f"Online company search failed: {e}")

    # ── Prompt Construction ─────────────────────────────────────────────

    def _build_prompt(
        self,
        company_name: str,
        promoters: str,
        directors: str,
        industry: str,
        location: str,
        manual_observations: str,
        financial_context: str,
    ) -> str:
        # Normalize entity names for better search if short forms detected
        name_variants = self._generate_name_variants(company_name)
        variants_str = (
          ", ".join(name_variants) if name_variants else company_name
        )

        directors_line = ""
        if directors:
            directors_line = f"\nDirectors: {directors}"

        financial_line = ""
        if financial_context:
            financial_line = f"""

FINANCIAL CONTEXT FROM DOCUMENT ANALYSIS (Module 1):
{financial_context}
Use these financial findings to enhance your risk assessment. If there are GST-Bank mismatches,
high leverage, or other financial red flags, factor them into your risk scores and signals."""

        observations_line = ""
        if manual_observations:
            observations_line = f"""

CREDIT OFFICER'S FIELD OBSERVATIONS:
{manual_observations}
Incorporate these observations into your risk analysis. For example, low capacity utilization
should increase operational risk, management concerns should affect governance risk."""

        return f"""You are an expert credit intelligence analyst for an Indian financial institution. You are performing comprehensive due diligence on a company that has applied for a credit facility. Your job is to uncover hidden risks, financial networks, and external signals that financial statements alone cannot reveal.

COMPANY UNDER INVESTIGATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━
Company Name: {company_name}
Name Variants: {variants_str}
Promoters: {promoters or 'Not specified'}
{directors_line}Industry: {industry or 'Not specified'}
Location: {location or 'Not specified'}
{financial_line}{observations_line}

YOUR TASK:
Conduct a thorough background investigation and generate a realistic intelligence report.
You MUST cover ALL of the following areas comprehensively:

1. COMPANY PROFILE — Background, establishment year, key business areas, size estimate
2. NEWS INTELLIGENCE — Recent events about the company, promoters, and industry (generate exactly 4-5 items spanning positive, negative, and neutral)
3. LITIGATION & LEGAL — Court cases, disputes, regulatory actions (generate exactly 2-3 items)
4. CORPORATE REGISTRY — MCA registration details, director history with DINs, compliance status, other directorships for each director
5. INDUSTRY ANALYSIS — Sector health, growth trends, regulatory environment, risks and opportunities
6. PROMOTER NETWORK — Map ALL connections between promoters/directors and other entities (generate exactly 5-6 connections including at least one flagged entity)
7. RISK SIGNALS — Specific red flags across categories: fraud, governance, financial, legal, operational, market (generate exactly 4-6 signals)
8. RISK SCORES — Numerical scores 0-100 for each category (0=no risk, 100=extreme risk). The overall_external_risk should be a weighted average.

IMPORTANT GUIDELINES:
• If this is a real, well-known company, use accurate factual information
• If not well-known, generate realistic, plausible findings typical for this industry and company type
• Be balanced — include BOTH positive indicators AND risk factors
• Risk scores MUST be consistent with your findings
• For Indian companies: reference NCLT, High Courts, MCA, RBI, SEBI, GST authorities
• Each director must have at least 1-2 other directorships listed
• The promoter network MUST include at least one entity with risk_flag=true
• Include specific monetary amounts in INR (₹ Cr / ₹ Lakhs)
• Dates should be realistic and recent (within last 3 years for news, varied for litigation)

Return ONLY valid JSON. No markdown, no code blocks, no explanation — just the raw JSON object.

{JSON_TEMPLATE}"""

    # ── Name Variant Generation ─────────────────────────────────────────

    @staticmethod
    def _generate_name_variants(company_name: str) -> list:
        """Generate common name variants for better search coverage."""
        variants = [company_name]
        name = company_name.strip()

        # Pvt Ltd → Private Limited and vice versa
        if "Pvt Ltd" in name:
            variants.append(name.replace("Pvt Ltd", "Private Limited"))
            variants.append(name.replace(" Pvt Ltd", ""))
        elif "Private Limited" in name:
            variants.append(name.replace("Private Limited", "Pvt Ltd"))
            variants.append(name.replace(" Private Limited", ""))

        # Ltd → Limited
        if name.endswith(" Ltd") and "Pvt" not in name:
            variants.append(name.replace(" Ltd", " Limited"))
            variants.append(name.replace(" Ltd", ""))

        # Remove common suffixes for short form
        for suffix in [" Industries", " Enterprises", " Corporation", " Group", " & Co"]:
            if suffix in name:
                short = name.split(suffix)[0].strip()
                if len(short) > 3:
                    variants.append(short)

        return list(dict.fromkeys(variants))  # deduplicate preserving order

    # ── JSON Parsing ────────────────────────────────────────────────────

    @staticmethod
    def _parse_json_response(raw_text: str) -> Dict[str, Any]:
        """Extract and parse JSON from Gemini response, handling common issues."""
        text = raw_text.strip()

        # Strip markdown code fences
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try to find JSON object in the text
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        # Last resort: try fixing common issues
        text = text.replace("'", '"')
        text = re.sub(r",\s*}", "}", text)
        text = re.sub(r",\s*]", "]", text)

        return json.loads(text)
