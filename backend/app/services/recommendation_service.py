"""Explain the provisional municipality recommendation classifier output."""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

LEVEL_ACTIONS = {
    "NORMAL": ["Continue normal monitoring and routine operations."],
    "ELEVATED": ["Monitor municipal demand closely and confirm the available operating margin."],
    "HIGH": [
        "Review reserve availability for the selected municipality.",
        "Prepare load-balancing actions for the expected daily peak.",
    ],
    "CRITICAL": [
        "Prepare reserve supply and verify contingency procedures.",
        "Defer non-essential maintenance during the expected peak period.",
        "Issue a targeted demand-conservation advisory.",
    ],
}


def _unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))


def build_recommendation(
    classifier,
    *,
    municipality: str,
    supply_system: str,
    grid_connected: int,
    predicted_consumption_kwh: float,
    predicted_peak_demand_kw: float,
    available_capacity_kw: float | None,
    rolling_mean_30_kwh: float,
    heat_index_c: float,
    rainfall_mm: float,
    is_holiday: int,
    is_weekend: int,
) -> dict[str, Any]:
    consumption_vs_30d = (predicted_consumption_kwh / rolling_mean_30_kwh - 1) * 100
    capacity_utilization = (
        predicted_peak_demand_kw / available_capacity_kw * 100
        if available_capacity_kw is not None and available_capacity_kw > 0
        else None
    )

    reasons: list[str] = []
    if capacity_utilization is None:
        # Never use the classifier's capacity-related result when capacity is unknown.
        if consumption_vs_30d >= 10:
            level = "HIGH"
            reasons.append("CONSUMPTION_AT_LEAST_10_PERCENT_ABOVE_30_DAY_MEAN")
        elif consumption_vs_30d >= 5:
            level = "ELEVATED"
            reasons.append("CONSUMPTION_AT_LEAST_5_PERCENT_ABOVE_30_DAY_MEAN")
        else:
            level = "NORMAL"
            reasons.append("CONSUMPTION_WITHIN_EXPECTED_MUNICIPAL_RANGE")
        reasons.append("CAPACITY_DATA_NOT_SUPPLIED")
        basis = "consumption_trend_only_no_capacity_shortage_claim"
    else:
        feature_row = pd.DataFrame(
            [
                {
                    "municipality": municipality,
                    "supply_system": supply_system,
                    "forecast_capacity_utilization_pct": capacity_utilization,
                    "forecast_consumption_vs_30d_pct": consumption_vs_30d,
                    "heat_index_mean_c": heat_index_c,
                    "rainfall_mm": rainfall_mm,
                    "is_holiday": is_holiday,
                    "is_weekend": is_weekend,
                    "grid_connected": grid_connected,
                }
            ]
        )
        level = str(classifier.predict(feature_row)[0]).upper()
        reasons.append(f"PROVISIONAL_CLASSIFIER_PREDICTED_{level}")
        if capacity_utilization >= 90:
            reasons.append("CAPACITY_UTILIZATION_AT_OR_ABOVE_90_PERCENT")
        elif capacity_utilization >= 80:
            reasons.append("CAPACITY_UTILIZATION_AT_OR_ABOVE_80_PERCENT")
        elif capacity_utilization >= 70:
            reasons.append("CAPACITY_UTILIZATION_AT_OR_ABOVE_70_PERCENT")
        if consumption_vs_30d >= 10:
            reasons.append("CONSUMPTION_AT_LEAST_10_PERCENT_ABOVE_30_DAY_MEAN")
        elif consumption_vs_30d >= 5:
            reasons.append("CONSUMPTION_AT_LEAST_5_PERCENT_ABOVE_30_DAY_MEAN")
        basis = "trained_provisional_classifier"

    actions = list(LEVEL_ACTIONS.get(level, LEVEL_ACTIONS["NORMAL"]))
    if capacity_utilization is None:
        actions.append(
            "Provide available capacity to enable capacity-utilization and shortage-risk calculations."
        )
    if heat_index_c >= 36:
        reasons.append("HIGH_HEAT_INDEX")
        actions.append("Expect stronger afternoon cooling demand.")
    if rainfall_mm >= 40:
        reasons.append("HEAVY_RAINFALL")
        actions.append("Check weather-related interruption readiness.")
    if is_holiday:
        reasons.append("HOLIDAY_DEMAND_PATTERN")
    if not grid_connected:
        reasons.append("MODELED_ISOLATED_OR_LOCAL_GRID")
        actions.append("Interpret capacity risk using the local-grid synthetic assumption.")

    return {
        "demand_level": level,
        "capacity_utilization_pct": None
        if capacity_utilization is None
        else round(float(capacity_utilization), 2),
        "consumption_vs_30d_pct": round(float(consumption_vs_30d), 2),
        "reason_codes": _unique(reasons),
        "recommended_actions": _unique(actions),
        "basis": basis,
        "capacity_data_provided": capacity_utilization is not None,
        "expert_validation_required": True,
        "classifier_is_provisional": True,
    }
