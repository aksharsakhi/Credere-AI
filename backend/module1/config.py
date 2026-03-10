"""
Module 1 Configuration
Enterprise Data Ingestor - Configuration Management
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""

    # Gemini API
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-preview-04-17")

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Upload
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    MAX_FILE_SIZE_MB: int = 50

    # Document Categories
    DOCUMENT_CATEGORIES = {
        "annual_report": "Annual Report",
        "financial_statement": "Financial Statement",
        "bank_statement": "Bank Statement",
        "gst_filing": "GST Filing",
        "rating_report": "Rating Agency Report",
    }

    # Required fields for complete financial analysis
    REQUIRED_FINANCIAL_FIELDS = {
        "revenue": {"source_docs": ["annual_report", "financial_statement", "gst_filing"]},
        "profit": {"source_docs": ["annual_report", "financial_statement"]},
        "total_debt": {"source_docs": ["annual_report", "financial_statement"]},
        "total_assets": {"source_docs": ["annual_report", "financial_statement"]},
        "total_liabilities": {"source_docs": ["annual_report", "financial_statement"]},
        "cash_flow": {"source_docs": ["annual_report", "financial_statement"]},
        "equity": {"source_docs": ["annual_report", "financial_statement"]},
        "interest_expense": {"source_docs": ["annual_report", "financial_statement"]},
        "ebit": {"source_docs": ["annual_report", "financial_statement"]},
        "current_assets": {"source_docs": ["annual_report", "financial_statement"]},
        "current_liabilities": {"source_docs": ["annual_report", "financial_statement"]},
        "gst_revenue": {"source_docs": ["gst_filing"]},
        "bank_inflow": {"source_docs": ["bank_statement"]},
        "bank_outflow": {"source_docs": ["bank_statement"]},
    }

    # Cross-verification thresholds
    GST_BANK_DEVIATION_THRESHOLD: float = 0.25  # 25% deviation triggers alert
    CIRCULAR_TRADING_THRESHOLD: float = 0.40  # 40% deviation = high risk

    # Financial ratio benchmarks (industry standard)
    RATIO_BENCHMARKS = {
        "debt_to_equity": {"healthy": 2.0, "warning": 3.0, "critical": 5.0},
        "interest_coverage": {"healthy": 3.0, "warning": 1.5, "critical": 1.0},
        "current_ratio": {"healthy": 1.5, "warning": 1.0, "critical": 0.8},
        "profit_margin": {"healthy": 0.10, "warning": 0.05, "critical": 0.02},
        "revenue_growth": {"healthy": 0.10, "warning": 0.0, "critical": -0.10},
    }


settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
