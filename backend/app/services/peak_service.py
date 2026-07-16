"""Municipality-aware peak-demand estimation using the trained regression pipeline."""
from __future__ import annotations

import numpy as np
import pandas as pd


def estimate_peak_demand_kw(
    model,
    *,
    municipality: str,
    supply_system: str,
    forecast_consumption_kwh: float,
    temperature_mean_c: float,
    humidity_mean_pct: float,
    rainfall_mm: float,
    heat_index_mean_c: float,
    is_holiday: int,
    is_weekend: int,
    customer_count: float,
) -> float:
    row = pd.DataFrame(
        [
            {
                "municipality": municipality,
                "supply_system": supply_system,
                "forecast_consumption_kwh": forecast_consumption_kwh,
                "temperature_mean_c": temperature_mean_c,
                "humidity_mean_pct": humidity_mean_pct,
                "rainfall_mm": rainfall_mm,
                "heat_index_mean_c": heat_index_mean_c,
                "is_holiday": is_holiday,
                "is_weekend": is_weekend,
                "customer_count": customer_count,
            }
        ]
    )
    return float(max(float(model.predict(row)[0]), 0.0))
