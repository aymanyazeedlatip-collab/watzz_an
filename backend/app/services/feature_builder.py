"""Build municipality-specific MLR features without future-data leakage."""
from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd
from sqlmodel import Session, select

from app.models.database_models import ForecastRecord
from app.utils.exceptions import ValidationFailedError

LAG_DAYS = (1, 2, 7, 14, 30)
ROLLING_WINDOWS = (7, 14, 30)


def compute_calendar_features(forecast_date: date) -> dict[str, Any]:
    day_of_year = forecast_date.timetuple().tm_yday
    return {
        "day_of_week": forecast_date.strftime("%A"),
        "month_category": str(forecast_date.month),
        "is_weekend": 1 if forecast_date.weekday() >= 5 else 0,
        "doy_sin": math.sin(2 * math.pi * day_of_year / 365.25),
        "doy_cos": math.cos(2 * math.pi * day_of_year / 365.25),
    }


def municipality_frame(active_df: pd.DataFrame, municipality: str) -> pd.DataFrame:
    if "municipality" not in active_df.columns:
        raise ValidationFailedError(
            "The active dataset is not municipality-level.",
            details="Upload or activate wattzan_municipality_model_dataset.csv.",
        )
    frame = active_df[active_df["municipality"] == municipality].copy()
    if frame.empty:
        raise ValidationFailedError(
            f"No historical rows were found for {municipality}.",
            details="The selected municipality must exist in the active dataset.",
        )
    return frame.sort_values("date").reset_index(drop=True)


def get_municipality_profile(active_df: pd.DataFrame, municipality: str) -> dict[str, Any]:
    frame = municipality_frame(active_df, municipality)
    latest = frame.iloc[-1]

    def value(name: str, default=None):
        if name not in frame.columns:
            return default
        result = latest[name]
        return default if pd.isna(result) else result

    return {
        "municipality": municipality,
        "psgc_code": str(value("psgc_code", "")),
        "latitude": float(value("latitude", np.nan)),
        "longitude": float(value("longitude", np.nan)),
        "climate_zone": str(value("climate_zone", "UNKNOWN")),
        "supply_system": str(value("supply_system", "UNKNOWN")),
        "grid_connected": int(value("grid_connected", 1)),
        "population": float(value("population", np.nan)),
        "customer_count": float(value("customer_count", np.nan)),
        "last_observed_date": frame["date"].max().date(),
    }


def build_history_lookups(
    active_df: pd.DataFrame,
    municipality: str,
    session: Session,
) -> tuple[dict[date, float], dict[date, float], dict[date, float], dict[date, str]]:
    """Build observed history and append sequential one-day predictions for one municipality."""
    frame = municipality_frame(active_df, municipality)
    consumption: dict[date, float] = {}
    temperature: dict[date, float] = {}
    rainfall: dict[date, float] = {}
    sources: dict[date, str] = {}

    for _, row in frame.iterrows():
        day = row["date"].date()
        consumption[day] = float(row["consumption_kwh"])
        temperature[day] = float(row["temperature_mean_c"])
        rainfall[day] = float(row["rainfall_mm"])
        sources[day] = "observed"

    records = session.exec(
        select(ForecastRecord)
        .where(ForecastRecord.forecast_type == "one_day_ahead")
        .where(ForecastRecord.municipality == municipality)
        .order_by(ForecastRecord.forecast_date, ForecastRecord.created_at)
    ).all()

    # If a date was forecast more than once, use the newest record for that date.
    newest_by_date: dict[date, ForecastRecord] = {}
    for record in records:
        newest_by_date[record.forecast_date] = record

    for day in sorted(newest_by_date):
        if day in consumption:
            continue
        record = newest_by_date[day]
        consumption[day] = float(record.selected_prediction_kwh)
        input_data = record.input_data_json or {}
        if input_data.get("temperature_mean_c") is not None:
            temperature[day] = float(input_data["temperature_mean_c"])
        if input_data.get("rainfall_mm") is not None:
            rainfall[day] = float(input_data["rainfall_mm"])
        sources[day] = "predicted"

    return consumption, temperature, rainfall, sources


def _require_dates(lookup: dict[date, float], required: list[date], label: str) -> None:
    missing = sorted({day for day in required if day not in lookup})
    if missing:
        raise ValidationFailedError(
            f"Not enough municipality-specific {label} history to forecast this date.",
            details=(
                f"Missing {len(missing)} date(s); earliest missing date: {missing[0].isoformat()}. "
                "Forecast the next sequential date or activate a dataset with newer history."
            ),
        )


def get_lag_and_rolling_features_from_lookup(
    forecast_date: date,
    consumption: dict[date, float],
    temperature: dict[date, float],
    rainfall: dict[date, float],
    sources: dict[date, str],
) -> tuple[dict[str, float], dict[str, list[str]]]:
    lag_dates = {lag: forecast_date - timedelta(days=lag) for lag in LAG_DAYS}
    rolling_dates = {
        window: [forecast_date - timedelta(days=offset) for offset in range(1, window + 1)]
        for window in ROLLING_WINDOWS
    }
    all_consumption_dates = list(lag_dates.values()) + [
        day for dates in rolling_dates.values() for day in dates
    ]
    _require_dates(consumption, all_consumption_dates, "consumption")
    _require_dates(temperature, [forecast_date - timedelta(days=1)], "temperature")
    _require_dates(rainfall, [forecast_date - timedelta(days=1)], "rainfall")

    features: dict[str, float] = {
        f"consumption_lag_{lag}": float(consumption[day])
        for lag, day in lag_dates.items()
    }
    for window, days in rolling_dates.items():
        values = np.asarray([consumption[day] for day in days], dtype=float)
        features[f"rolling_mean_{window}"] = float(np.mean(values))
    seven_values = np.asarray([consumption[day] for day in rolling_dates[7]], dtype=float)
    features["rolling_std_7"] = float(np.std(seven_values, ddof=1))
    features["temperature_lag_1"] = float(temperature[forecast_date - timedelta(days=1)])
    features["rainfall_lag_1"] = float(rainfall[forecast_date - timedelta(days=1)])

    used_dates = sorted(
        {
            day.isoformat()
            for day in all_consumption_dates
            if sources.get(day) == "predicted"
        }
    )
    return features, {"lag_dates_based_on_predictions": used_dates}


def build_mlr_feature_row(
    *,
    municipality: str,
    profile: dict[str, Any],
    day_input: Any,
    lag_features: dict[str, float],
    feature_order: list[str],
) -> pd.DataFrame:
    calendar = compute_calendar_features(day_input.date if hasattr(day_input, "date") else day_input.forecast_date)
    forecast_date = day_input.date if hasattr(day_input, "date") else day_input.forecast_date
    heat_index = day_input.heat_index_mean_c
    if heat_index is None:
        heat_index = day_input.temperature_mean_c

    combined: dict[str, Any] = {
        "municipality": municipality,
        "climate_zone": profile["climate_zone"],
        "supply_system": profile["supply_system"],
        "grid_connected": profile["grid_connected"],
        "population": day_input.population if day_input.population is not None else profile["population"],
        "customer_count": day_input.customer_count if day_input.customer_count is not None else profile["customer_count"],
        "temperature_mean_c": day_input.temperature_mean_c,
        "temperature_min_c": day_input.temperature_min_c if day_input.temperature_min_c is not None else np.nan,
        "temperature_max_c": day_input.temperature_max_c if day_input.temperature_max_c is not None else np.nan,
        "humidity_mean_pct": day_input.humidity_mean_pct,
        "rainfall_mm": day_input.rainfall_mm,
        "heat_index_mean_c": heat_index,
        "wind_speed_mean_kph": day_input.wind_speed_mean_kph if day_input.wind_speed_mean_kph is not None else np.nan,
        "cloud_cover_mean_pct": day_input.cloud_cover_mean_pct if day_input.cloud_cover_mean_pct is not None else np.nan,
        "is_holiday": day_input.is_holiday,
        "is_special_event": getattr(day_input, "is_special_event", 0),
        **calendar,
        **lag_features,
    }
    missing = [feature for feature in feature_order if feature not in combined]
    if missing:
        raise ValidationFailedError(
            "Could not construct every feature required by the municipality MLR.",
            details=f"Missing features: {missing}",
        )
    return pd.DataFrame(
        [{feature: combined[feature] for feature in feature_order}],
        columns=feature_order,
    )
