"""
Understanding Engine
====================
Core component that combines OCR, Layout Detection, and LLM-based extraction
(Gemini 2.5 Flash) to convert messy PDFs into structured financial data.

Pipeline:
  PDF → Text Extraction (pdfplumber) → Text-based Table Detection → LLM Extraction → Financial Data
"""

import json
import re
import logging
import google.generativeai as genai
from typing import Optional, Dict, Any, List

from ..config import settings
from ..models.financial_data import ExtractedFinancialData, FinancialTable
from ..utils.pdf_utils import extract_text_from_pdf, extract_tables_from_pdf, get_page_count

logger = logging.getLogger(__name__)

# ── Gemini prompt for structured financial extraction ──────────────────────

EXTRACTION_PROMPT = """You are an expert financial analyst AI. Your task is to extract structured financial data from the given document text.

DOCUMENT CATEGORY: {category}
DOCUMENT TEXT:
---
{text}
---

Extract the following financial data points from the text above. Return ONLY a valid JSON object with these keys:
{{
    "company_name": "string or null",
    "fiscal_year": "string (e.g., '2023-24') or null",
    "revenue": "float in Crores or null",
    "profit": "float in Crores (net profit) or null",
    "total_debt": "float in Crores or null",
    "total_assets": "float in Crores or null",
    "total_liabilities": "float in Crores or null",
    "cash_flow": "float in Crores (operating cash flow) or null",
    "equity": "float in Crores (shareholders equity / net worth) or null",
    "interest_expense": "float in Crores or null",
    "ebit": "float in Crores (Earnings Before Interest and Tax) or null",
    "current_assets": "float in Crores or null",
    "current_liabilities": "float in Crores or null",
    "gst_revenue": "float in Crores (revenue reported in GST) or null",
    "bank_inflow": "float in Crores (total credits/inflow in bank) or null",
    "bank_outflow": "float in Crores (total debits/outflow in bank) or null"
}}

Important rules:
1. Convert ALL monetary values to Crores (1 Crore = 10 Million INR).
2. If a value is given in Lakhs, divide by 100 to convert to Crores.
3. If a data point is not found in the text, set it to null.
4. For bank statements, focus on total credits (inflow) and total debits (outflow).
5. For GST filings, extract the total taxable value as gst_revenue.
6. Return ONLY the JSON — no explanations, no markdown formatting.
"""


class UnderstandingEngine:
    """
    Converts raw PDF documents into structured financial data using:
    1. pdfplumber for text and table extraction (OCR + Layout)
    2. Smart text-based table detection (fallback for space-separated tables)
    3. Gemini 2.5 Flash for intelligent data structuring
    """

    def __init__(self):
        self._configure_gemini()

    def _configure_gemini(self):
        """Initialize Gemini API."""
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel("gemini-2.5-flash")
            self.gemini_available = True
            logger.info("Gemini API configured successfully")
        else:
            self.model = None
            self.gemini_available = False
            logger.warning("Gemini API key not set — LLM extraction disabled")

    async def extract_from_pdf(
        self, file_path: str, category: str
    ) -> Dict[str, Any]:
        """
        Full extraction pipeline for a single PDF.
        """
        logger.info(f"Starting extraction: {file_path} (category={category})")

        # Step 1: Extract raw text
        raw_text = extract_text_from_pdf(file_path)
        page_count = get_page_count(file_path)

        if not raw_text.strip():
            logger.warning(f"No text extracted from {file_path}")
            return {
                "financial_data": ExtractedFinancialData(source_document=category),
                "tables": [],
                "raw_text": "",
                "page_count": page_count,
                "confidence_score": 0.0,
            }

        # Step 2: Extract tables via pdfplumber
        raw_tables = extract_tables_from_pdf(file_path)
        parsed_tables = self._process_raw_tables(raw_tables)

        # Step 2b: Smart text-based table extraction (always try as fallback)
        if not parsed_tables:
            logger.info("pdfplumber found no tables — running text-based extraction")
            text_tables = self._extract_tables_from_text(raw_text)
            if text_tables:
                parsed_tables.extend(text_tables)
                logger.info(f"Text extraction found {len(text_tables)} table(s)")
            else:
                logger.warning("Text-based extraction also found no tables")

        # Step 3: LLM-based structured extraction
        financial_data = await self._llm_extract(raw_text, category)
        financial_data.source_document = category

        # Step 4: Compute confidence
        confidence = self._compute_confidence(financial_data)

        return {
            "financial_data": financial_data,
            "tables": parsed_tables,
            "raw_text": raw_text[:2000],
            "page_count": page_count,
            "confidence_score": confidence,
        }

    async def _llm_extract(self, text: str, category: str) -> ExtractedFinancialData:
        """Use Gemini to extract structured financial data from text."""
        if not self.gemini_available:
            logger.warning("Gemini not available — returning empty extraction")
            return ExtractedFinancialData()

        truncated_text = text[:15000]
        prompt = EXTRACTION_PROMPT.format(category=category, text=truncated_text)

        try:
            response = self.model.generate_content(prompt)
            response_text = response.text.strip()

            if response_text.startswith("```"):
                response_text = response_text.split("\n", 1)[1]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]
                response_text = response_text.strip()

            data = json.loads(response_text)
            return ExtractedFinancialData(**data)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response as JSON: {e}")
            return ExtractedFinancialData()
        except Exception as e:
            logger.error(f"Gemini extraction failed: {e}")
            return ExtractedFinancialData()

    def _process_raw_tables(self, raw_tables: List[Dict]) -> List[FinancialTable]:
        """Convert raw pdfplumber tables to structured FinancialTable models."""
        tables = []
        for rt in raw_tables:
            table = FinancialTable(
                table_name=f"Table from page {rt.get('page', '?')}",
                headers=rt.get("headers", []),
                rows=rt.get("rows", []),
                source_page=rt.get("page"),
            )
            tables.append(table)
        return tables

    # ══════════════════════════════════════════════════════════════
    #  TEXT-BASED TABLE EXTRACTION
    # ══════════════════════════════════════════════════════════════

    def _extract_tables_from_text(self, text: str) -> List[FinancialTable]:
        """
        Smart text-based table extraction.

        Handles two common PDF text formats:

        FORMAT A — "Year as rows" (year in first column):
            Year  Revenue (Cr)  Net Profit (Cr)  ...
            2022  110           7
            2023  120           6
            2024  145           8

        FORMAT B — "Year as columns" (years in header):
            Metric         FY2022  FY2023  FY2024
            Revenue        110     120     145
            Net Profit     7       6       8
        """
        tables: List[FinancialTable] = []

        # Try Format A first (most common)
        fmt_a = self._extract_year_as_rows(text)
        if fmt_a:
            tables.extend(fmt_a)

        # Try Format B
        fmt_b = self._extract_year_as_columns(text)
        if fmt_b:
            tables.extend(fmt_b)

        # Try pipe-separated tables
        pipe_tables = self._extract_pipe_tables(text)
        if pipe_tables:
            tables.extend(pipe_tables)

        return tables

    def _extract_year_as_rows(self, text: str) -> List[FinancialTable]:
        """
        Detect tables where years are in the first column.

        Pattern:
            Year  Revenue (Cr)  Net Profit (Cr)  Total Debt (Cr)  ...
            2022  110           7                40               ...
            2023  120           6                48               ...
        """
        tables = []
        lines = text.split('\n')

        for i, line in enumerate(lines):
            stripped = line.strip()
            # Look for header line that starts with "Year" and has financial keywords
            if not re.match(r'^Year\b', stripped, re.IGNORECASE):
                continue

            # This is a potential header line
            # Parse the header: split by 2+ spaces or extract parenthesized tokens
            header_parts = self._smart_split_header(stripped)
            if len(header_parts) < 2:
                continue

            logger.info(f"Format A header detected: {header_parts}")

            # Read data rows that start with a year (e.g., 2022, 2023)
            rows = []
            for j in range(i + 1, min(i + 20, len(lines))):
                row_line = lines[j].strip()
                if not row_line:
                    break

                # Must start with a 4-digit year
                year_match = re.match(r'^((?:FY\s*)?20\d{2})\s+(.+)', row_line)
                if not year_match:
                    break

                year_str = year_match.group(1).strip()
                rest = year_match.group(2).strip()

                # Split the remaining values by whitespace
                values = rest.split()

                row_dict = {header_parts[0]: year_str}
                for vi, val in enumerate(values):
                    if vi + 1 < len(header_parts):
                        row_dict[header_parts[vi + 1]] = val
                rows.append(row_dict)

            if len(rows) >= 2:
                tables.append(FinancialTable(
                    table_name="Financial Performance Summary",
                    headers=header_parts,
                    rows=rows,
                ))
                logger.info(f"Format A table: {len(header_parts)} cols, {len(rows)} rows")

        return tables

    def _extract_year_as_columns(self, text: str) -> List[FinancialTable]:
        """
        Detect tables where years are column headers.

        Pattern:
            Metric       FY2022  FY2023  FY2024
            Revenue      110     120     145
            Net Profit   7       6       8
        """
        tables = []
        lines = text.split('\n')

        financial_keywords = [
            'revenue', 'profit', 'sales', 'turnover', 'debt', 'assets',
            'liabilities', 'equity', 'ebit', 'ebitda', 'income', 'expense',
            'cash flow', 'margin', 'net worth'
        ]

        for i, line in enumerate(lines):
            stripped = line.strip()

            # Look for a header line containing year patterns like FY2022, 2022, FY2023 etc
            year_pattern = re.findall(r'(?:FY\s*)?20\d{2}(?:\-\d{2,4})?', stripped)
            if len(year_pattern) < 2:
                continue

            # Check there's also a metric label (Metric, Particulars, etc.)
            has_label = bool(re.search(
                r'(metric|particular|item|detail|financial|description)',
                stripped, re.IGNORECASE
            ))

            # Extract the "label" column name and year column names
            first_year_pos = stripped.find(year_pattern[0])
            label_col = stripped[:first_year_pos].strip() or "Metric"
            year_headers = year_pattern

            headers = [label_col] + year_headers
            logger.info(f"Format B header detected: {headers}")

            # Read data rows
            rows = []
            for j in range(i + 1, min(i + 20, len(lines))):
                row_line = lines[j].strip()
                if not row_line:
                    break

                # Row should have a text label followed by numbers
                # e.g., "Revenue (INR Cr) 110 120 145"
                # Split: everything before the first number is the label
                parts_match = re.match(r'^(.+?)\s+([\d.]+(?:\s+[\d.]+)*)\s*$', row_line)
                if not parts_match:
                    # Check if it's just a number line (continuation)
                    if re.match(r'^[\d.\s]+$', row_line):
                        continue
                    break

                row_label = parts_match.group(1).strip()
                number_str = parts_match.group(2).strip()
                numbers = number_str.split()

                # Check if this looks financial
                is_financial = any(kw in row_label.lower() for kw in financial_keywords)
                if not is_financial and len(rows) == 0:
                    continue

                row_dict = {label_col: row_label}
                for vi, num in enumerate(numbers):
                    if vi < len(year_headers):
                        row_dict[year_headers[vi]] = num
                rows.append(row_dict)

            if len(rows) >= 2:
                tables.append(FinancialTable(
                    table_name="Financial Highlights",
                    headers=headers,
                    rows=rows,
                ))
                logger.info(f"Format B table: {len(headers)} cols, {len(rows)} rows")

        return tables

    def _extract_pipe_tables(self, text: str) -> List[FinancialTable]:
        """Extract tables with pipe separators (Year | Revenue | Profit)."""
        tables = []
        pattern = re.compile(
            r'(?:^|\n)\s*([^\n]*\|[^\n]*)'
            r'((?:\s*\n\s*[^\n]*\|[^\n]*)+)',
            re.MULTILINE
        )

        for match in pattern.finditer(text):
            header_line = match.group(1).strip()
            data_block = match.group(2).strip()

            headers = [h.strip() for h in header_line.split('|') if h.strip()]
            if len(headers) < 2:
                continue

            rows = []
            for row_line in data_block.split('\n'):
                row_line = row_line.strip()
                if not row_line or set(row_line) <= {'-', '|', '+', ' '}:
                    continue
                cells = [c.strip() for c in row_line.split('|') if c.strip()]
                if len(cells) >= 2:
                    row_dict = {}
                    for ci, cell in enumerate(cells):
                        key = headers[ci] if ci < len(headers) else f"Col_{ci}"
                        row_dict[key] = cell
                    rows.append(row_dict)

            if rows:
                tables.append(FinancialTable(
                    table_name="Financial Data (pipe-separated)",
                    headers=headers,
                    rows=rows,
                ))

        return tables

    def _smart_split_header(self, header_line: str) -> List[str]:
        """
        Smart header splitting for space-separated financial table headers.

        Handles headers like:
            "Year Revenue (Cr) Net Profit (Cr) Total Debt (Cr) ..."

        Strategy: "Year" is always the first column. Then split remaining
        by parenthesized units like (Cr), (%), (INR Cr).
        """
        # Step 1: Extract "Year" as a separate first column
        remaining = header_line.strip()
        first_col = None
        year_match = re.match(r'^(Year)\s+', remaining, re.IGNORECASE)
        if year_match:
            first_col = year_match.group(1)
            remaining = remaining[year_match.end():]
        
        # Step 2: Split remaining by parenthesized units
        # Each column header ends with (Cr), (INR Cr), (%), etc.
        parts = re.split(r'\)\s+', remaining)
        if len(parts) >= 2:
            headers = []
            if first_col:
                headers.append(first_col)
            for p in parts:
                p = p.strip()
                if p:
                    if not p.endswith(')') and '(' in p:
                        p += ')'
                    headers.append(p)
            if len(headers) >= 2:
                return headers

        # Fallback: split by 2+ spaces
        parts = re.split(r'  +', header_line.strip())
        if len(parts) >= 2:
            return [p.strip() for p in parts if p.strip()]

        # Last resort: split by single space
        return header_line.strip().split()

    def _compute_confidence(self, data: ExtractedFinancialData) -> float:
        """Compute extraction confidence score (0.0 → 1.0)."""
        key_fields = [
            "revenue", "profit", "total_debt", "total_assets",
            "total_liabilities", "cash_flow", "equity",
        ]
        filled = sum(1 for f in key_fields if getattr(data, f, None) is not None)
        return round(filled / len(key_fields), 2)
