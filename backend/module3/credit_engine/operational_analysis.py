"""Operational observations scoring for Module 3 credit intelligence."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np


def _clamp_0_100(value: float) -> int:
    return int(np.clip(round(value), 0, 100))


def score_operational_observations(
    operational_data: Dict[str, Any],
) -> Tuple[int, List[str], Dict[str, float]]:
    """
    Inputs are expected as 0-100 style scores.
    - factory_utilization: higher is better
    - management_rating: higher is better
    """
    factory_utilization = float(
        operational_data.get("factory_utilization", 50.0) or 50.0
    )
    management_rating = float(
        operational_data.get("management_rating", 50.0) or 50.0
    )

    factory_utilization = float(np.clip(factory_utilization, 0.0, 100.0))
    management_rating = float(np.clip(management_rating, 0.0, 100.0))

    score = (factory_utilization * 0.55) + (management_rating * 0.45)

    explanations: List[str] = []
    if factory_utilization < 50:
        explanations.append(
            f"Factory utilization is low ({factory_utilization:.0f}%)."
        )
    if management_rating < 60:
        explanations.append(
            "Management quality rating is below benchmark "
            f"({management_rating:.0f}/100)."
        )

    metrics = {
        "factory_utilization": factory_utilization,
        "management_rating": management_rating,
    }
    return _clamp_0_100(score), explanations, metrics
