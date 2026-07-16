"""Forecast-history API with optional municipality filtering."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.database import get_session
from app.services import history_service
from app.services.municipality_catalog import normalize_municipality
from app.utils.exceptions import NotFoundError

router = APIRouter(prefix="/api/forecast", tags=["history"])


def _record_to_dict(record) -> dict:
    return {
        "forecast_id": record.id,
        "municipality": record.municipality,
        "location": {"latitude": record.latitude, "longitude": record.longitude},
        "forecast_date": record.forecast_date.isoformat(),
        "forecast_type": record.forecast_type,
        "mlr_prediction_kwh": record.mlr_prediction_kwh,
        "sarima_prediction_kwh": record.sarima_prediction_kwh,
        "hybrid_prediction_kwh": record.hybrid_prediction_kwh,
        "selected_prediction_kwh": record.selected_prediction_kwh,
        "estimated_peak_demand_kw": record.estimated_peak_demand_kw,
        "available_capacity_kw": record.available_capacity_kw,
        "capacity_utilization_pct": record.capacity_utilization_pct,
        "demand_level": record.demand_level,
        "reason_codes": record.reason_codes,
        "recommended_actions": record.recommended_actions,
        "model_version": record.model_version,
        "input_data": record.input_data_json,
        "created_at": record.created_at.isoformat(),
    }


@router.get("/history")
def get_forecast_history(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    demand_level: str | None = Query(default=None),
    forecast_type: str | None = Query(default=None),
    municipality: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    session: Session = Depends(get_session),
) -> dict:
    normalized = normalize_municipality(municipality) if municipality else None
    records = history_service.list_forecasts(
        session,
        start_date=start_date,
        end_date=end_date,
        demand_level=demand_level,
        forecast_type=forecast_type,
        municipality=normalized,
        limit=limit,
    )
    return {"count": len(records), "forecasts": [_record_to_dict(record) for record in records]}


@router.get("/history/{forecast_id}")
def get_forecast_by_id(forecast_id: str, session: Session = Depends(get_session)) -> dict:
    record = history_service.get_forecast(session, forecast_id)
    if record is None:
        raise NotFoundError(f"Forecast '{forecast_id}' was not found.")
    return _record_to_dict(record)


@router.delete("/history/{forecast_id}")
def delete_forecast_by_id(forecast_id: str, session: Session = Depends(get_session)) -> dict:
    if not history_service.delete_forecast(session, forecast_id):
        raise NotFoundError(f"Forecast '{forecast_id}' was not found.")
    return {"forecast_id": forecast_id, "deleted": True}
