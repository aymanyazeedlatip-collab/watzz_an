"""Municipality-aware one-day and seven-day MLR-SARIMA forecasting."""
from __future__ import annotations

import math
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

import numpy as np
import pandas as pd
from sqlmodel import Session, select

from app.config import settings
from app.models.database_models import ForecastRecord
from app.schemas.forecast import (
    ForecastCurrentDayRequest,
    ForecastCurrentWeekRequest,
    ForecastOneDayRequest,
    ForecastSevenDayRequest,
)
from app.services import (
    feature_builder,
    peak_service,
    preprocessing_service,
    recommendation_service,
)
from app.services.model_loader import ModelBundle
from app.utils.exceptions import ModelUnavailableError, NotFoundError, ValidationFailedError
from app.utils.logging_config import get_logger

logger = get_logger(__name__)

DATA_WARNING = (
    "Hybrid research municipality-level model; Tacurong annual load anchors use original SUKELCO ledgers while daily profiles remain derived. "
    "Not official observed municipal utility or weather data."
)


def _first_value(values) -> float:
    if hasattr(values, "iloc"):
        return float(values.iloc[0])
    array = np.asarray(values, dtype=float).reshape(-1)
    return float(array[0])


def _to_array(values) -> np.ndarray:
    if hasattr(values, "to_numpy"):
        return np.asarray(values.to_numpy(), dtype=float).reshape(-1)
    return np.asarray(values, dtype=float).reshape(-1)


def _clamp(value: float, label: str) -> tuple[float, dict | None]:
    if value >= 0:
        return value, None
    logger.warning("%s was negative (%.4f); operational output was clamped to zero.", label, value)
    return 0.0, {"event": "negative_prediction_clamped", "label": label, "raw_value": value}


def _latest_sequential_forecasts(
    session: Session, municipality: str, base_date: date
) -> list[ForecastRecord]:
    records = session.exec(
        select(ForecastRecord)
        .where(ForecastRecord.forecast_type == "one_day_ahead")
        .where(ForecastRecord.municipality == municipality)
        .where(ForecastRecord.forecast_date > base_date)
        .order_by(ForecastRecord.forecast_date, ForecastRecord.created_at)
    ).all()
    newest: dict[date, ForecastRecord] = {}
    for record in records:
        newest[record.forecast_date] = record

    sequential: list[ForecastRecord] = []
    expected = base_date + timedelta(days=1)
    while expected in newest:
        sequential.append(newest[expected])
        expected += timedelta(days=1)
    return sequential


def _effective_sarima_states(
    model_bundle: ModelBundle,
    municipality: str,
    session: Session,
) -> tuple[Any, Any, date]:
    direct = model_bundle.direct_sarima[municipality]
    residual = model_bundle.residual_sarima[municipality]
    history = model_bundle.production_history
    if history is None:
        raise ModelUnavailableError("Municipality production history is unavailable.")

    location_history = history[history["municipality"] == municipality]
    base_date = pd.Timestamp(location_history["date"].max()).date()
    last_date = base_date

    for record in _latest_sequential_forecasts(session, municipality, base_date):
        timestamp = pd.DatetimeIndex([pd.Timestamp(record.forecast_date)])
        direct_observation = pd.Series(
            [math.log(max(float(record.selected_prediction_kwh), 1e-9))],
            index=timestamp,
            name="consumption_kwh",
        )
        mlr_value = float(record.mlr_prediction_kwh or record.selected_prediction_kwh)
        residual_observation = pd.Series(
            [float(record.selected_prediction_kwh) - mlr_value],
            index=timestamp,
            name="production_mlr_residual_kwh",
        )
        direct = direct.extend(direct_observation)
        residual = residual.extend(residual_observation)
        last_date = record.forecast_date

    return direct, residual, last_date


def _model_feature_order(bundle: ModelBundle) -> list[str]:
    config = bundle.feature_config or {}
    return list(config.get("categorical_features", [])) + list(config.get("numeric_features", []))


def _hybrid_weight(bundle: ModelBundle, municipality: str) -> float:
    config = bundle.sarima_config or {}
    return float(config.get(municipality, {}).get("hybrid_weight", 1.0))


def _ensure_ready(bundle: ModelBundle, municipality: str) -> None:
    if not bundle.production_ready:
        raise ModelUnavailableError(
            "The municipality production model bundle is unavailable.",
            details="Check GET /api/models/status to identify the failed component.",
        )
    if municipality not in bundle.direct_sarima or municipality not in bundle.residual_sarima:
        raise ModelUnavailableError(
            f"SARIMA artifacts for {municipality} are unavailable.",
            details="Check GET /api/models/status for municipality-specific artifact status.",
        )


def _prediction_components(
    *,
    bundle: ModelBundle,
    municipality: str,
    mlr_row: pd.DataFrame,
    direct_forecast: float,
    residual_forecast: float,
) -> tuple[float, float, float, list[dict]]:
    diagnostics: list[dict] = []
    mlr_raw = float(bundle.mlr.predict(mlr_row)[0])
    sarima_raw = math.exp(float(direct_forecast))
    hybrid_raw = mlr_raw + _hybrid_weight(bundle, municipality) * float(residual_forecast)

    mlr, diagnostic = _clamp(mlr_raw, "Municipality MLR prediction")
    if diagnostic:
        diagnostics.append(diagnostic)
    sarima, diagnostic = _clamp(sarima_raw, "Municipality direct SARIMA prediction")
    if diagnostic:
        diagnostics.append(diagnostic)
    hybrid, diagnostic = _clamp(hybrid_raw, "Municipality hybrid prediction")
    if diagnostic:
        diagnostics.append(diagnostic)
    return mlr, sarima, hybrid, diagnostics


def _estimate_peak_and_recommendation(
    *,
    bundle: ModelBundle,
    municipality: str,
    profile: dict[str, Any],
    day_input: Any,
    hybrid_prediction: float,
    rolling_mean_30: float,
) -> tuple[float, dict]:
    calendar = feature_builder.compute_calendar_features(
        day_input.date if hasattr(day_input, "date") else day_input.forecast_date
    )
    heat_index = day_input.heat_index_mean_c
    if heat_index is None:
        heat_index = day_input.temperature_mean_c
    customer_count = (
        day_input.customer_count
        if day_input.customer_count is not None
        else profile["customer_count"]
    )
    peak_kw = peak_service.estimate_peak_demand_kw(
        bundle.peak_estimator,
        municipality=municipality,
        supply_system=profile["supply_system"],
        forecast_consumption_kwh=hybrid_prediction,
        temperature_mean_c=day_input.temperature_mean_c,
        humidity_mean_pct=day_input.humidity_mean_pct,
        rainfall_mm=day_input.rainfall_mm,
        heat_index_mean_c=heat_index,
        is_holiday=day_input.is_holiday,
        is_weekend=calendar["is_weekend"],
        customer_count=float(customer_count),
    )
    recommendation = recommendation_service.build_recommendation(
        bundle.recommendation_classifier,
        municipality=municipality,
        supply_system=profile["supply_system"],
        grid_connected=profile["grid_connected"],
        predicted_consumption_kwh=hybrid_prediction,
        predicted_peak_demand_kw=peak_kw,
        available_capacity_kw=day_input.available_capacity_kw,
        rolling_mean_30_kwh=rolling_mean_30,
        heat_index_c=heat_index,
        rainfall_mm=day_input.rainfall_mm,
        is_holiday=day_input.is_holiday,
        is_weekend=calendar["is_weekend"],
    )
    return peak_kw, recommendation


def run_one_day_forecast(
    payload: ForecastOneDayRequest,
    session: Session,
    model_bundle: ModelBundle,
) -> dict:
    municipality = payload.municipality
    _ensure_ready(model_bundle, municipality)

    active_df, dataset_record = preprocessing_service.load_active_dataframe(session)
    if active_df is None:
        raise NotFoundError("No active municipality dataset is available.")

    profile = feature_builder.get_municipality_profile(active_df, municipality)
    consumption, temperature, rainfall, sources = feature_builder.build_history_lookups(
        active_df, municipality, session
    )
    direct_state, residual_state, model_last_date = _effective_sarima_states(
        model_bundle, municipality, session
    )
    expected_date = model_last_date + timedelta(days=1)
    if payload.forecast_date != expected_date:
        raise ValidationFailedError(
            "forecast_date must be the next sequential date for the selected municipality.",
            details=(
                f"Expected {expected_date.isoformat()} for {municipality}; "
                f"the model and stored one-day history currently end on {model_last_date.isoformat()}."
            ),
        )

    lag_features, lag_metadata = feature_builder.get_lag_and_rolling_features_from_lookup(
        payload.forecast_date, consumption, temperature, rainfall, sources
    )
    feature_row = feature_builder.build_mlr_feature_row(
        municipality=municipality,
        profile=profile,
        day_input=payload,
        lag_features=lag_features,
        feature_order=_model_feature_order(model_bundle),
    )

    direct_forecast = _first_value(direct_state.forecast(steps=1))
    residual_forecast = _first_value(residual_state.forecast(steps=1))
    mlr_prediction, sarima_prediction, hybrid_prediction, diagnostics = _prediction_components(
        bundle=model_bundle,
        municipality=municipality,
        mlr_row=feature_row,
        direct_forecast=direct_forecast,
        residual_forecast=residual_forecast,
    )
    peak_kw, recommendation = _estimate_peak_and_recommendation(
        bundle=model_bundle,
        municipality=municipality,
        profile=profile,
        day_input=payload,
        hybrid_prediction=hybrid_prediction,
        rolling_mean_30=lag_features["rolling_mean_30"],
    )

    forecast_id = uuid.uuid4().hex
    record = ForecastRecord(
        id=forecast_id,
        municipality=municipality,
        latitude=payload.latitude,
        longitude=payload.longitude,
        forecast_date=payload.forecast_date,
        forecast_type="one_day_ahead",
        mlr_prediction_kwh=round(mlr_prediction, 2),
        sarima_prediction_kwh=round(sarima_prediction, 2),
        hybrid_prediction_kwh=round(hybrid_prediction, 2),
        selected_prediction_kwh=round(hybrid_prediction, 2),
        estimated_peak_demand_kw=round(peak_kw, 2),
        available_capacity_kw=payload.available_capacity_kw,
        capacity_utilization_pct=recommendation["capacity_utilization_pct"],
        demand_level=recommendation["demand_level"],
        reason_codes=recommendation["reason_codes"],
        recommended_actions=recommendation["recommended_actions"],
        model_version=settings.app_version,
        input_data_json=payload.model_dump(mode="json"),
    )
    session.add(record)
    session.commit()

    logger.info(
        "Created municipality forecast %s for %s on %s: hybrid=%.2f kWh",
        forecast_id,
        municipality,
        payload.forecast_date,
        hybrid_prediction,
    )
    return {
        "forecast_id": forecast_id,
        "municipality": municipality,
        "psgc_code": profile["psgc_code"],
        "location": {
            "latitude": payload.latitude if payload.latitude is not None else profile["latitude"],
            "longitude": payload.longitude if payload.longitude is not None else profile["longitude"],
        },
        "supply_system": profile["supply_system"],
        "grid_connected": bool(profile["grid_connected"]),
        "forecast_date": payload.forecast_date.isoformat(),
        "forecast_type": "one_day_ahead",
        "mlr_prediction_kwh": round(mlr_prediction, 2),
        "sarima_prediction_kwh": round(sarima_prediction, 2),
        "hybrid_prediction_kwh": round(hybrid_prediction, 2),
        "selected_prediction_kwh": round(hybrid_prediction, 2),
        "selected_model": "municipality_hybrid_mlr_sarima",
        "hybrid_residual_weight": _hybrid_weight(model_bundle, municipality),
        "estimated_peak_demand_kw": round(peak_kw, 2),
        "available_capacity_kw": payload.available_capacity_kw,
        "capacity_utilization_pct": recommendation["capacity_utilization_pct"],
        "demand_level": recommendation["demand_level"],
        "reason_codes": recommendation["reason_codes"],
        "recommended_actions": recommendation["recommended_actions"],
        "recommendation_basis": recommendation["basis"],
        "expert_validation_required": True,
        "classifier_is_provisional": True,
        "model_version": settings.app_version,
        "active_dataset": dataset_record.original_file_name if dataset_record else None,
        "data_warning": DATA_WARNING,
        "lag_dates_based_on_predictions": lag_metadata["lag_dates_based_on_predictions"],
        "diagnostics": diagnostics or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def run_seven_day_forecast(
    payload: ForecastSevenDayRequest,
    session: Session,
    model_bundle: ModelBundle,
) -> dict:
    municipality = payload.municipality
    _ensure_ready(model_bundle, municipality)

    active_df, dataset_record = preprocessing_service.load_active_dataframe(session)
    if active_df is None:
        raise NotFoundError("No active municipality dataset is available.")
    profile = feature_builder.get_municipality_profile(active_df, municipality)
    consumption, temperature, rainfall, sources = feature_builder.build_history_lookups(
        active_df, municipality, session
    )
    direct_state, residual_state, model_last_date = _effective_sarima_states(
        model_bundle, municipality, session
    )
    expected_start = model_last_date + timedelta(days=1)
    if payload.start_date != expected_start:
        raise ValidationFailedError(
            "start_date must be the next sequential date for the selected municipality.",
            details=f"Expected {expected_start.isoformat()} for {municipality}.",
        )

    direct_forecasts = _to_array(direct_state.forecast(steps=7))
    residual_forecasts = _to_array(residual_state.forecast(steps=7))
    daily_results: list[dict] = []
    forecast_ids: list[str] = []

    for index, day_input in enumerate(payload.days):
        lag_features, lag_metadata = feature_builder.get_lag_and_rolling_features_from_lookup(
            day_input.date, consumption, temperature, rainfall, sources
        )
        feature_row = feature_builder.build_mlr_feature_row(
            municipality=municipality,
            profile=profile,
            day_input=day_input,
            lag_features=lag_features,
            feature_order=_model_feature_order(model_bundle),
        )
        mlr_prediction, sarima_prediction, hybrid_prediction, diagnostics = _prediction_components(
            bundle=model_bundle,
            municipality=municipality,
            mlr_row=feature_row,
            direct_forecast=direct_forecasts[index],
            residual_forecast=residual_forecasts[index],
        )
        peak_kw, recommendation = _estimate_peak_and_recommendation(
            bundle=model_bundle,
            municipality=municipality,
            profile=profile,
            day_input=day_input,
            hybrid_prediction=hybrid_prediction,
            rolling_mean_30=lag_features["rolling_mean_30"],
        )

        consumption[day_input.date] = hybrid_prediction
        temperature[day_input.date] = day_input.temperature_mean_c
        rainfall[day_input.date] = day_input.rainfall_mm
        sources[day_input.date] = "predicted"

        forecast_id = uuid.uuid4().hex
        forecast_ids.append(forecast_id)
        session.add(
            ForecastRecord(
                id=forecast_id,
                municipality=municipality,
                latitude=payload.latitude,
                longitude=payload.longitude,
                forecast_date=day_input.date,
                forecast_type="seven_day_recursive",
                mlr_prediction_kwh=round(mlr_prediction, 2),
                sarima_prediction_kwh=round(sarima_prediction, 2),
                hybrid_prediction_kwh=round(hybrid_prediction, 2),
                selected_prediction_kwh=round(hybrid_prediction, 2),
                estimated_peak_demand_kw=round(peak_kw, 2),
                available_capacity_kw=day_input.available_capacity_kw,
                capacity_utilization_pct=recommendation["capacity_utilization_pct"],
                demand_level=recommendation["demand_level"],
                reason_codes=recommendation["reason_codes"],
                recommended_actions=recommendation["recommended_actions"],
                model_version=settings.app_version,
                input_data_json={
                    "municipality": municipality,
                    **day_input.model_dump(mode="json"),
                },
            )
        )
        daily_results.append(
            {
                "forecast_id": forecast_id,
                "municipality": municipality,
                "forecast_date": day_input.date.isoformat(),
                "mlr_prediction_kwh": round(mlr_prediction, 2),
                "sarima_prediction_kwh": round(sarima_prediction, 2),
                "hybrid_prediction_kwh": round(hybrid_prediction, 2),
                "selected_prediction_kwh": round(hybrid_prediction, 2),
                "estimated_peak_demand_kw": round(peak_kw, 2),
                "available_capacity_kw": day_input.available_capacity_kw,
                "capacity_utilization_pct": recommendation["capacity_utilization_pct"],
                "demand_level": recommendation["demand_level"],
                "reason_codes": recommendation["reason_codes"],
                "recommended_actions": recommendation["recommended_actions"],
                "lag_dates_based_on_predictions": lag_metadata["lag_dates_based_on_predictions"],
                "diagnostics": diagnostics or None,
            }
        )

    session.commit()
    values = [item["hybrid_prediction_kwh"] for item in daily_results]
    highest = max(daily_results, key=lambda item: item["hybrid_prediction_kwh"])
    lowest = min(daily_results, key=lambda item: item["hybrid_prediction_kwh"])
    utilizations = [
        item["capacity_utilization_pct"]
        for item in daily_results
        if item["capacity_utilization_pct"] is not None
    ]

    return {
        "forecast_type": "seven_day_recursive",
        "municipality": municipality,
        "psgc_code": profile["psgc_code"],
        "location": {
            "latitude": payload.latitude if payload.latitude is not None else profile["latitude"],
            "longitude": payload.longitude if payload.longitude is not None else profile["longitude"],
        },
        "supply_system": profile["supply_system"],
        "grid_connected": bool(profile["grid_connected"]),
        "start_date": payload.start_date.isoformat(),
        "daily_forecasts": daily_results,
        "weekly_total_kwh": round(sum(values), 2),
        "weekly_average_kwh": round(float(np.mean(values)), 2),
        "highest_demand_date": highest["forecast_date"],
        "lowest_demand_date": lowest["forecast_date"],
        "maximum_capacity_utilization_pct": max(utilizations) if utilizations else None,
        "hybrid_residual_weight": _hybrid_weight(model_bundle, municipality),
        "model_version": settings.app_version,
        "active_dataset": dataset_record.original_file_name if dataset_record else None,
        "data_warning": DATA_WARNING,
        "forecast_limitation": (
            "The published municipality metrics represent rolling one-day-ahead forecasts. "
            "This fixed seven-day recursive extension can accumulate error because predicted "
            "values become lag inputs for later days."
        ),
        "expert_validation_required": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def get_next_forecast_date(
    municipality: str,
    session: Session,
    model_bundle: ModelBundle,
) -> dict:
    """Return the strict next sequential date without creating a forecast."""
    _ensure_ready(model_bundle, municipality)
    active_df, dataset_record = preprocessing_service.load_active_dataframe(session)
    if active_df is None:
        raise NotFoundError("No active municipality dataset is available.")
    profile = feature_builder.get_municipality_profile(active_df, municipality)
    _, _, model_last_date = _effective_sarima_states(model_bundle, municipality, session)
    expected_date = model_last_date + timedelta(days=1)
    return {
        "municipality": municipality,
        "psgc_code": profile["psgc_code"],
        "last_model_state_date": model_last_date.isoformat(),
        "next_sequential_date": expected_date.isoformat(),
        "active_dataset": dataset_record.original_file_name if dataset_record else None,
    }



def run_current_day_scenario(
    payload: ForecastCurrentDayRequest,
    session: Session,
    model_bundle: ModelBundle,
) -> dict:
    """Bridge missing dates recursively and return only the requested target day.

    This scenario endpoint preserves the strict one-day endpoint while allowing the UI
    to forecast the current date when observed electricity history has not yet been
    uploaded. Bridge days are calculated in memory and are not saved to forecast history.
    """
    municipality = payload.municipality
    _ensure_ready(model_bundle, municipality)

    active_df, dataset_record = preprocessing_service.load_active_dataframe(session)
    if active_df is None:
        raise NotFoundError("No active municipality dataset is available.")

    profile = feature_builder.get_municipality_profile(active_df, municipality)
    consumption, temperature, rainfall, sources = feature_builder.build_history_lookups(
        active_df, municipality, session
    )
    direct_state, residual_state, model_last_date = _effective_sarima_states(
        model_bundle, municipality, session
    )
    expected_start = model_last_date + timedelta(days=1)
    supplied_start = payload.days[0].date
    if supplied_start != expected_start:
        raise ValidationFailedError(
            "The current-day scenario bridge must begin on the next sequential model date.",
            details=(
                f"Expected the first weather row to be {expected_start.isoformat()} for "
                f"{municipality}, but received {supplied_start.isoformat()}."
            ),
        )
    if payload.target_date < expected_start:
        raise ValidationFailedError(
            "target_date is earlier than the next sequential model date.",
            details=f"The earliest allowed date is {expected_start.isoformat()}.",
        )

    expected_total_days = (payload.target_date - expected_start).days + 1
    if len(payload.days) != expected_total_days:
        raise ValidationFailedError(
            "The scenario weather series does not cover the complete bridge and target date.",
            details=(
                f"Expected {expected_total_days} consecutive daily rows from "
                f"{expected_start.isoformat()} through {payload.target_date.isoformat()}, "
                f"but received {len(payload.days)}."
            ),
        )
    if expected_total_days > 800:
        raise ValidationFailedError(
            "The requested scenario gap is too large for one run.",
            details="Upload newer observed electricity history or choose a date within 800 days of the model state.",
        )

    logger.info(
        "Running current-day gap-bridge scenario for %s: %s through %s (%d days).",
        municipality,
        expected_start,
        payload.target_date,
        expected_total_days,
    )

    direct_forecasts = _to_array(direct_state.forecast(steps=expected_total_days))
    residual_forecasts = _to_array(residual_state.forecast(steps=expected_total_days))
    bridge_days_count = max(0, expected_total_days - 1)
    target_result: dict | None = None

    for index, day_input in enumerate(payload.days):
        lag_features, lag_metadata = feature_builder.get_lag_and_rolling_features_from_lookup(
            day_input.date, consumption, temperature, rainfall, sources
        )
        feature_row = feature_builder.build_mlr_feature_row(
            municipality=municipality,
            profile=profile,
            day_input=day_input,
            lag_features=lag_features,
            feature_order=_model_feature_order(model_bundle),
        )
        mlr_prediction, sarima_prediction, hybrid_prediction, diagnostics = _prediction_components(
            bundle=model_bundle,
            municipality=municipality,
            mlr_row=feature_row,
            direct_forecast=direct_forecasts[index],
            residual_forecast=residual_forecasts[index],
        )

        consumption[day_input.date] = hybrid_prediction
        temperature[day_input.date] = day_input.temperature_mean_c
        rainfall[day_input.date] = day_input.rainfall_mm
        sources[day_input.date] = "scenario_bridge" if day_input.date < payload.target_date else "predicted"

        if day_input.date != payload.target_date:
            continue

        peak_kw, recommendation = _estimate_peak_and_recommendation(
            bundle=model_bundle,
            municipality=municipality,
            profile=profile,
            day_input=day_input,
            hybrid_prediction=hybrid_prediction,
            rolling_mean_30=lag_features["rolling_mean_30"],
        )
        forecast_id = uuid.uuid4().hex
        record_input = {
            "municipality": municipality,
            **day_input.model_dump(mode="json"),
            "scenario_bridge": True,
            "bridge_start_date": expected_start.isoformat(),
            "bridge_days_before_target": bridge_days_count,
            "target_date": payload.target_date.isoformat(),
        }
        session.add(
            ForecastRecord(
                id=forecast_id,
                municipality=municipality,
                latitude=payload.latitude,
                longitude=payload.longitude,
                forecast_date=day_input.date,
                forecast_type="current_day_gap_bridge_scenario",
                mlr_prediction_kwh=round(mlr_prediction, 2),
                sarima_prediction_kwh=round(sarima_prediction, 2),
                hybrid_prediction_kwh=round(hybrid_prediction, 2),
                selected_prediction_kwh=round(hybrid_prediction, 2),
                estimated_peak_demand_kw=round(peak_kw, 2),
                available_capacity_kw=day_input.available_capacity_kw,
                capacity_utilization_pct=recommendation["capacity_utilization_pct"],
                demand_level=recommendation["demand_level"],
                reason_codes=recommendation["reason_codes"],
                recommended_actions=recommendation["recommended_actions"],
                model_version=settings.app_version,
                input_data_json=record_input,
            )
        )
        target_result = {
            "forecast_id": forecast_id,
            "municipality": municipality,
            "psgc_code": profile["psgc_code"],
            "location": {
                "latitude": payload.latitude if payload.latitude is not None else profile["latitude"],
                "longitude": payload.longitude if payload.longitude is not None else profile["longitude"],
            },
            "supply_system": profile["supply_system"],
            "grid_connected": bool(profile["grid_connected"]),
            "forecast_date": day_input.date.isoformat(),
            "forecast_type": "current_day_gap_bridge_scenario",
            "scenario_mode": "recursive_gap_bridge",
            "bridge_start_date": expected_start.isoformat(),
            "bridge_end_date": (payload.target_date - timedelta(days=1)).isoformat() if bridge_days_count else None,
            "bridge_days_count": bridge_days_count,
            "base_model_state_date": model_last_date.isoformat(),
            "mlr_prediction_kwh": round(mlr_prediction, 2),
            "sarima_prediction_kwh": round(sarima_prediction, 2),
            "hybrid_prediction_kwh": round(hybrid_prediction, 2),
            "selected_prediction_kwh": round(hybrid_prediction, 2),
            "selected_model": "municipality_hybrid_mlr_sarima",
            "hybrid_residual_weight": _hybrid_weight(model_bundle, municipality),
            "estimated_peak_demand_kw": round(peak_kw, 2),
            "available_capacity_kw": day_input.available_capacity_kw,
            "capacity_utilization_pct": recommendation["capacity_utilization_pct"],
            "demand_level": recommendation["demand_level"],
            "reason_codes": recommendation["reason_codes"],
            "recommended_actions": recommendation["recommended_actions"],
            "recommendation_basis": recommendation["basis"],
            "expert_validation_required": True,
            "classifier_is_provisional": True,
            "model_version": settings.app_version,
            "active_dataset": dataset_record.original_file_name if dataset_record else None,
            "data_warning": DATA_WARNING,
            "forecast_limitation": (
                f"This one-day scenario recursively bridged {bridge_days_count} missing day(s) "
                "using model predictions and date-matched weather rather than observed electricity "
                "consumption. Error can accumulate across a long bridge. Upload actual municipal "
                "electricity history for stronger research or operational validity."
            ),
            "lag_dates_based_on_predictions": lag_metadata["lag_dates_based_on_predictions"],
            "diagnostics": diagnostics or None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    if target_result is None:
        raise ValidationFailedError("The scenario did not produce the requested target-day forecast.")

    session.commit()
    return target_result

def run_current_week_scenario(
    payload: ForecastCurrentWeekRequest,
    session: Session,
    model_bundle: ModelBundle,
) -> dict:
    """Bridge missing dates recursively, then return only the requested seven-day window.

    This is intentionally a separate scenario endpoint. It does not weaken the strict
    production one-day/seven-day endpoints and it does not save the synthetic bridge days.
    """
    municipality = payload.municipality
    _ensure_ready(model_bundle, municipality)

    active_df, dataset_record = preprocessing_service.load_active_dataframe(session)
    if active_df is None:
        raise NotFoundError("No active municipality dataset is available.")

    profile = feature_builder.get_municipality_profile(active_df, municipality)
    consumption, temperature, rainfall, sources = feature_builder.build_history_lookups(
        active_df, municipality, session
    )
    direct_state, residual_state, model_last_date = _effective_sarima_states(
        model_bundle, municipality, session
    )
    expected_start = model_last_date + timedelta(days=1)
    supplied_start = payload.days[0].date
    if supplied_start != expected_start:
        raise ValidationFailedError(
            "The scenario bridge must begin on the next sequential model date.",
            details=(
                f"Expected the first weather row to be {expected_start.isoformat()} for "
                f"{municipality}, but received {supplied_start.isoformat()}."
            ),
        )
    if payload.target_start_date < expected_start:
        raise ValidationFailedError(
            "target_start_date is earlier than the next sequential model date.",
            details=f"The earliest allowed date is {expected_start.isoformat()}.",
        )

    target_end = payload.target_start_date + timedelta(days=6)
    expected_total_days = (target_end - expected_start).days + 1
    if len(payload.days) != expected_total_days:
        raise ValidationFailedError(
            "The scenario weather series does not cover the complete bridge and target week.",
            details=(
                f"Expected {expected_total_days} consecutive daily rows from "
                f"{expected_start.isoformat()} through {target_end.isoformat()}, "
                f"but received {len(payload.days)}."
            ),
        )
    if expected_total_days > 800:
        raise ValidationFailedError(
            "The requested scenario gap is too large for one run.",
            details="Upload newer observed electricity history or choose a date within 800 days of the model state.",
        )

    logger.info(
        "Running current-week gap-bridge scenario for %s: %s through %s (%d days).",
        municipality,
        expected_start,
        target_end,
        expected_total_days,
    )

    direct_forecasts = _to_array(direct_state.forecast(steps=expected_total_days))
    residual_forecasts = _to_array(residual_state.forecast(steps=expected_total_days))
    daily_results: list[dict] = []
    forecast_ids: list[str] = []
    bridge_days_count = max(0, (payload.target_start_date - expected_start).days)

    for index, day_input in enumerate(payload.days):
        lag_features, lag_metadata = feature_builder.get_lag_and_rolling_features_from_lookup(
            day_input.date, consumption, temperature, rainfall, sources
        )
        feature_row = feature_builder.build_mlr_feature_row(
            municipality=municipality,
            profile=profile,
            day_input=day_input,
            lag_features=lag_features,
            feature_order=_model_feature_order(model_bundle),
        )
        mlr_prediction, sarima_prediction, hybrid_prediction, diagnostics = _prediction_components(
            bundle=model_bundle,
            municipality=municipality,
            mlr_row=feature_row,
            direct_forecast=direct_forecasts[index],
            residual_forecast=residual_forecasts[index],
        )

        consumption[day_input.date] = hybrid_prediction
        temperature[day_input.date] = day_input.temperature_mean_c
        rainfall[day_input.date] = day_input.rainfall_mm
        sources[day_input.date] = "scenario_bridge" if day_input.date < payload.target_start_date else "predicted"

        if day_input.date < payload.target_start_date:
            continue

        peak_kw, recommendation = _estimate_peak_and_recommendation(
            bundle=model_bundle,
            municipality=municipality,
            profile=profile,
            day_input=day_input,
            hybrid_prediction=hybrid_prediction,
            rolling_mean_30=lag_features["rolling_mean_30"],
        )
        forecast_id = uuid.uuid4().hex
        forecast_ids.append(forecast_id)
        record_input = {
            "municipality": municipality,
            **day_input.model_dump(mode="json"),
            "scenario_bridge": True,
            "bridge_start_date": expected_start.isoformat(),
            "bridge_days_before_target": bridge_days_count,
            "target_start_date": payload.target_start_date.isoformat(),
        }
        session.add(
            ForecastRecord(
                id=forecast_id,
                municipality=municipality,
                latitude=payload.latitude,
                longitude=payload.longitude,
                forecast_date=day_input.date,
                forecast_type="current_week_gap_bridge_scenario",
                mlr_prediction_kwh=round(mlr_prediction, 2),
                sarima_prediction_kwh=round(sarima_prediction, 2),
                hybrid_prediction_kwh=round(hybrid_prediction, 2),
                selected_prediction_kwh=round(hybrid_prediction, 2),
                estimated_peak_demand_kw=round(peak_kw, 2),
                available_capacity_kw=day_input.available_capacity_kw,
                capacity_utilization_pct=recommendation["capacity_utilization_pct"],
                demand_level=recommendation["demand_level"],
                reason_codes=recommendation["reason_codes"],
                recommended_actions=recommendation["recommended_actions"],
                model_version=settings.app_version,
                input_data_json=record_input,
            )
        )
        daily_results.append(
            {
                "forecast_id": forecast_id,
                "municipality": municipality,
                "forecast_date": day_input.date.isoformat(),
                "mlr_prediction_kwh": round(mlr_prediction, 2),
                "sarima_prediction_kwh": round(sarima_prediction, 2),
                "hybrid_prediction_kwh": round(hybrid_prediction, 2),
                "selected_prediction_kwh": round(hybrid_prediction, 2),
                "estimated_peak_demand_kw": round(peak_kw, 2),
                "available_capacity_kw": day_input.available_capacity_kw,
                "capacity_utilization_pct": recommendation["capacity_utilization_pct"],
                "demand_level": recommendation["demand_level"],
                "reason_codes": recommendation["reason_codes"],
                "recommended_actions": recommendation["recommended_actions"],
                "lag_dates_based_on_predictions": lag_metadata["lag_dates_based_on_predictions"],
                "diagnostics": diagnostics or None,
            }
        )

    if len(daily_results) != 7:
        raise ValidationFailedError(
            "The scenario did not produce exactly seven target-day forecasts.",
            details=f"Produced {len(daily_results)} target rows instead of 7.",
        )

    session.commit()
    values = [item["hybrid_prediction_kwh"] for item in daily_results]
    highest = max(daily_results, key=lambda item: item["hybrid_prediction_kwh"])
    lowest = min(daily_results, key=lambda item: item["hybrid_prediction_kwh"])
    utilizations = [
        item["capacity_utilization_pct"]
        for item in daily_results
        if item["capacity_utilization_pct"] is not None
    ]

    return {
        "forecast_type": "current_week_gap_bridge_scenario",
        "scenario_mode": "recursive_gap_bridge",
        "municipality": municipality,
        "psgc_code": profile["psgc_code"],
        "location": {
            "latitude": payload.latitude if payload.latitude is not None else profile["latitude"],
            "longitude": payload.longitude if payload.longitude is not None else profile["longitude"],
        },
        "supply_system": profile["supply_system"],
        "grid_connected": bool(profile["grid_connected"]),
        "start_date": payload.target_start_date.isoformat(),
        "bridge_start_date": expected_start.isoformat(),
        "bridge_end_date": (
            (payload.target_start_date - timedelta(days=1)).isoformat()
            if bridge_days_count else None
        ),
        "bridge_days_count": bridge_days_count,
        "base_model_state_date": model_last_date.isoformat(),
        "daily_forecasts": daily_results,
        "weekly_total_kwh": round(sum(values), 2),
        "weekly_average_kwh": round(float(np.mean(values)), 2),
        "highest_demand_date": highest["forecast_date"],
        "lowest_demand_date": lowest["forecast_date"],
        "maximum_capacity_utilization_pct": max(utilizations) if utilizations else None,
        "hybrid_residual_weight": _hybrid_weight(model_bundle, municipality),
        "model_version": settings.app_version,
        "active_dataset": dataset_record.original_file_name if dataset_record else None,
        "data_warning": DATA_WARNING,
        "forecast_limitation": (
            f"This seven-day scenario recursively bridged {bridge_days_count} missing day(s) "
            "using model predictions and date-matched weather rather than observed electricity "
            "consumption. Error can accumulate substantially across a long bridge. For research "
            "or operational use, upload actual municipal electricity history through the day "
            "before the target week."
        ),
        "expert_validation_required": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

