"""
PDF Utility Functions
Low-level PDF extraction helpers using pdfplumber and PyPDF2.
"""

import pdfplumber
from PyPDF2 import PdfReader
from typing import List, Dict, Any, Optional
import re
import logging

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_path: str) -> str:
    """Extract all text from a PDF using pdfplumber (better for layout-aware extraction)."""
    full_text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n\n"
    except Exception as e:
        logger.error(f"pdfplumber extraction failed: {e}")
        # Fallback to PyPDF2
        try:
            reader = PdfReader(file_path)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n\n"
        except Exception as e2:
            logger.error(f"PyPDF2 extraction also failed: {e2}")
    return full_text.strip()


def extract_tables_from_pdf(file_path: str) -> List[Dict[str, Any]]:
    """Extract all tables from a PDF using pdfplumber."""
    all_tables = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                tables = page.extract_tables()
                if tables:
                    for table_idx, table in enumerate(tables):
                        if table and len(table) > 1:
                            # First row is typically headers
                            headers = [str(h).strip() if h else f"Col_{i}" for i, h in enumerate(table[0])]
                            rows = []
                            for row in table[1:]:
                                row_dict = {}
                                for i, cell in enumerate(row):
                                    key = headers[i] if i < len(headers) else f"Col_{i}"
                                    row_dict[key] = str(cell).strip() if cell else ""
                                rows.append(row_dict)
                            all_tables.append({
                                "page": page_num,
                                "table_index": table_idx,
                                "headers": headers,
                                "rows": rows,
                            })
    except Exception as e:
        logger.error(f"Table extraction failed: {e}")
    return all_tables


def get_page_count(file_path: str) -> int:
    """Get the number of pages in a PDF."""
    try:
        reader = PdfReader(file_path)
        return len(reader.pages)
    except Exception:
        try:
            with pdfplumber.open(file_path) as pdf:
                return len(pdf.pages)
        except Exception:
            return 0


def extract_text_by_pages(file_path: str) -> List[str]:
    """Extract text page by page."""
    pages = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                pages.append(text if text else "")
    except Exception as e:
        logger.error(f"Page-by-page extraction failed: {e}")
    return pages


def parse_currency_value(text: str) -> Optional[float]:
    """
    Parse Indian currency values from text.
    Handles formats like: ₹120 Cr, Rs. 45.5 Crores, 110 Cr, 7,500 Lakhs, etc.
    """
    if not text:
        return None

    text = text.strip()

    # Remove currency symbols
    text = re.sub(r'[₹$]', '', text)
    text = re.sub(r'Rs\.?\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'INR\s*', '', text, flags=re.IGNORECASE)

    # Determine multiplier
    multiplier = 1.0
    if re.search(r'crore|cr\.?', text, re.IGNORECASE):
        multiplier = 1.0  # Keep in Crores as base unit
        text = re.sub(r'\s*(crore|cr)s?\.?\s*', '', text, flags=re.IGNORECASE)
    elif re.search(r'lakh|lac|lacs', text, re.IGNORECASE):
        multiplier = 0.01  # Convert lakhs to crores
        text = re.sub(r'\s*(lakh|lac|lacs)s?\.?\s*', '', text, flags=re.IGNORECASE)
    elif re.search(r'million|mn', text, re.IGNORECASE):
        multiplier = 0.1  # Approx conversion to crores
        text = re.sub(r'\s*(million|mn)s?\.?\s*', '', text, flags=re.IGNORECASE)
    elif re.search(r'billion|bn', text, re.IGNORECASE):
        multiplier = 100.0  # Approx conversion to crores
        text = re.sub(r'\s*(billion|bn)s?\.?\s*', '', text, flags=re.IGNORECASE)

    # Remove commas and extra spaces
    text = text.replace(',', '').strip()

    # Extract number
    match = re.search(r'[-+]?\d+\.?\d*', text)
    if match:
        try:
            return float(match.group()) * multiplier
        except ValueError:
            return None
    return None
