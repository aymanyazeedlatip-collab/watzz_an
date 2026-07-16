"""POST /api/forecast/one-day"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.database import get_session
from app.schemas.forecast import ForecastCurrentDayRequest, ForecastCurrentWeekRequest, ForecastOneDayRequest, ForecastSevenDayRequest
from app.services import forecast_service
from app.services.municipality_catalog import normalize_municipality
from sqlmodel import Session

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


@router.post("/one-day")
def post_one_day_forecast(
    payload: ForecastOneDayRequest,
    request: Request,
    session: Session = Depends(get_session),
) -> dict:
    model_bundle = request.app.state.model_bundle
    return forecast_service.run_one_day_forecast(payload, session, model_bundle)


@router.post("/seven-day")
def post_seven_day_forecast(
    payload: ForecastSevenDayRequest,
    request: Request,
    session: Session = Depends(get_session),
) -> dict:
    model_bundle = request.app.state.model_bundle
    return forecast_service.run_seven_day_forecast(payload, session, model_bundle)

@router.get("/next-date")
def get_next_forecast_date(
    request: Request,
    municipality: str = Query(..., min_length=2),
    session: Session = Depends(get_session),
) -> dict:
    model_bundle = request.app.state.model_bundle
    normalized = normalize_municipality(municipality)
    return forecast_service.get_next_forecast_date(normalized, session, model_bundle)


@router.post("/current-day")
def post_current_day_scenario(
    payload: ForecastCurrentDayRequest,
    request: Request,
    session: Session = Depends(get_session),
) -> dict:
    model_bundle = request.app.state.model_bundle
    return forecast_service.run_current_day_scenario(payload, session, model_bundle)


@router.post("/current-week")
def post_current_week_scenario(
    payload: ForecastCurrentWeekRequest,
    request: Request,
    session: Session = Depends(get_session),
) -> dict:
    model_bundle = request.app.state.model_bundle
    return forecast_service.run_current_week_scenario(payload, session, model_bundle)

