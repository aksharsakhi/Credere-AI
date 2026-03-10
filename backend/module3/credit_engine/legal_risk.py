"""Legal risk scoring for Module 3 credit intelligence."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np


def _clamp_0_100(value: float) -> int:
    return int(np.clip(round(value), 0, 100))


def score_legal_risk(
    external_risk_data: Dict[str, Any],
) -> Tuple[int, List[str], Dict[str, float]]:
    """
    Higher litigation count and negative news reduce score.

    Inputs:
    - litigation_cases: int
    - negative_news_score: float in 0-100 (higher means more negative)
    """
    litigation_cases = int(external_risk_data.get("litigation_cases", 0) or 0)
    negative_news_score = float(
        external_risk_data.get("negative_news_score", 0.0) or 0.0
    )

    # Case penalty: nonlinear, each additional case hurts more early on.
    case_penalty = min(65.0, 12.0 * np.log1p(max(litigation_cases, 0)) * 1.8)
    # News penalty: linear from 0 to 35.
    news_penalty = np.clip(negative_news_score, 0.0, 100.0) * 0.35

    score = 100.0 - case_penalty - news_penalty

    explanations: List[str] = []
    if litigation_cases > 0:
        explanations.append(f"{litigation_cases} litigation case(s) detected.")
    if negative_news_score >= 60:
        explanations.append(
            "Negative news sentiment is elevated "
            f"({negative_news_score:.0f}/100)."
        )

    metrics = {
        "litigation_cases": float(litigation_cases),
        "negative_news_score": float(negative_news_score),
    }
    return _clamp_0_100(score), explanations, metrics
