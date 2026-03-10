"""
Module 2 Configuration
Research Agent — Digital Credit Manager
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Module2Settings:
    """Module 2 settings — reuses Gemini config from environment."""

    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-preview-04-17")

    # Risk score thresholds
    RISK_THRESHOLDS = {
        "Low": (0, 25),
        "Moderate": (26, 50),
        "High": (51, 75),
        "Critical": (76, 100),
    }


module2_settings = Module2Settings()
