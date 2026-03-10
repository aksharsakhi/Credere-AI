"""Industry risk scoring for Module 3 credit intelligence."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np


def _clamp_0_100(value: float) -> int:
    return int(np.clip(round(value), 0, 100))


def score_industry_risk(
    external_risk_data: Dict[str, Any],
) -> Tuple[int, List[str], Dict[str, float]]:
    """
    sector_risk_score is expected in 0-100 where higher = riskier sector.
    Convert to positive score where higher = better.
    """
    sector_risk_score = float(
        external_risk_data.get("sector_risk_score", 50.0) or 50.0
    )
    sector_risk_score = float(np.clip(sector_risk_score, 0.0, 100.0))

    # Invert risk to stability score.
    score = 100.0 - sector_risk_score

    explanations: List[str] = []
    if sector_risk_score >= 70:
        explanations.append("Industry sector risk is high.")
    elif sector_risk_score >= 40:
        explanations.append("Industry sector risk is moderate.")

    metrics = {"sector_risk_score": sector_risk_score}
    return _clamp_0_100(score), explanations, metrics
