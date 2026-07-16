"""Municipality-aware forecast-history queries."""
from __future__ import annotations

from datetime import date

from sqlmodel import Session, select

from app.models.database_models import ForecastRecord


def list_forecasts(
    session: Session,
    start_date: date | None = None,
    end_date: date | None = None,
    demand_level: str | None = None,
    forecast_type: str | None = None,
    municipality: str | None = None,
    limit: int = 200,
) -> list[ForecastRecord]:
    query = select(ForecastRecord)
    if start_date is not None:
        query = query.where(ForecastRecord.forecast_date >= start_date)
    if end_date is not None:
        query = query.where(ForecastRecord.forecast_date <= end_date)
    if demand_level is not None:
        query = query.where(ForecastRecord.demand_level == demand_level.upper())
    if forecast_type is not None:
        query = query.where(ForecastRecord.forecast_type == forecast_type)
    if municipality is not None:
        query = query.where(ForecastRecord.municipality == municipality)
    query = query.order_by(ForecastRecord.created_at.desc()).limit(limit)
    return list(session.exec(query).all())


def get_forecast(session: Session, forecast_id: str) -> ForecastRecord | None:
    return session.get(ForecastRecord, forecast_id)


def delete_forecast(session: Session, forecast_id: str) -> bool:
    record = session.get(ForecastRecord, forecast_id)
    if record is None:
        return False
    session.delete(record)
    session.commit()
    return True
