"""Promoter reputation scoring for Module 3 credit intelligence."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np


def _clamp_0_100(value: float) -> int:
    return int(np.clip(round(value), 0, 100))


def score_promoter_reputation(
    external_risk_data: Dict[str, Any],
) -> Tuple[int, List[str], Dict[str, float]]:
    """
    promoter_risk_score is expected in 0-100 where higher = riskier
    promoter profile.
    Convert to reputation quality score where higher = better.
    """
    promoter_risk_score = float(
        external_risk_data.get("promoter_risk_score", 50.0) or 50.0
    )
    promoter_risk_score = float(np.clip(promoter_risk_score, 0.0, 100.0))

    score = 100.0 - promoter_risk_score

    explanations: List[str] = []
    if promoter_risk_score >= 70:
        explanations.append("Promoter risk signals are significant.")
    elif promoter_risk_score >= 40:
        explanations.append("Promoter risk profile is moderate.")

    metrics = {"promoter_risk_score": promoter_risk_score}
    return _clamp_0_100(score), explanations, metrics
