"""Validated request shapes for municipality-aware electricity forecasts."""
from __future__ import annotations

import math
from datetime import date, timedelta

from pydantic import BaseModel, Field, field_validator, model_validator

from app.services.municipality_catalog import normalize_municipality


NUMERIC_FIELDS = (
    "temperature_mean_c",
    "temperature_min_c",
    "temperature_max_c",
    "humidity_mean_pct",
    "rainfall_mm",
    "heat_index_mean_c",
    "wind_speed_mean_kph",
    "cloud_cover_mean_pct",
    "population",
    "customer_count",
    "available_capacity_kw",
    "latitude",
    "longitude",
)


class ForecastOneDayRequest(BaseModel):
    municipality: str
    forecast_date: date
    latitude: float | None = Field(default=None, ge=5.0, le=8.0)
    longitude: float | None = Field(default=None, ge=123.0, le=126.0)
    temperature_mean_c: float = Field(..., ge=-10, le=55)
    temperature_min_c: float | None = Field(default=None, ge=-10, le=55)
    temperature_max_c: float | None = Field(default=None, ge=-10, le=55)
    humidity_mean_pct: float = Field(..., ge=0, le=100)
    rainfall_mm: float = Field(..., ge=0, le=1000)
    heat_index_mean_c: float | None = Field(default=None, ge=-10, le=65)
    wind_speed_mean_kph: float | None = Field(default=None, ge=0, le=300)
    cloud_cover_mean_pct: float | None = Field(default=None, ge=0, le=100)
    population: float | None = Field(default=None, gt=0)
    customer_count: float | None = Field(default=None, gt=0)
    is_holiday: int = Field(..., ge=0, le=1)
    holiday_name: str | None = Field(default=None, max_length=120)
    is_special_event: int = Field(default=0, ge=0, le=1)
    available_capacity_kw: float | None = Field(default=None, gt=0)

    @field_validator("municipality")
    @classmethod
    def normalize_location(cls, value: str) -> str:
        return normalize_municipality(value)

    @field_validator(*NUMERIC_FIELDS, mode="before")
    @classmethod
    def reject_nan_and_infinite(cls, value):
        if value is None:
            return value
        if isinstance(value, (int, float)) and not math.isfinite(value):
            raise ValueError("Value must be a finite number; NaN and infinity are not allowed.")
        return value


class DailyWeatherInput(BaseModel):
    date: date
    temperature_mean_c: float = Field(..., ge=-10, le=55)
    temperature_min_c: float | None = Field(default=None, ge=-10, le=55)
    temperature_max_c: float | None = Field(default=None, ge=-10, le=55)
    humidity_mean_pct: float = Field(..., ge=0, le=100)
    rainfall_mm: float = Field(..., ge=0, le=1000)
    heat_index_mean_c: float | None = Field(default=None, ge=-10, le=65)
    wind_speed_mean_kph: float | None = Field(default=None, ge=0, le=300)
    cloud_cover_mean_pct: float | None = Field(default=None, ge=0, le=100)
    population: float | None = Field(default=None, gt=0)
    customer_count: float | None = Field(default=None, gt=0)
    is_holiday: int = Field(..., ge=0, le=1)
    is_special_event: int = Field(default=0, ge=0, le=1)
    available_capacity_kw: float | None = Field(default=None, gt=0)

    @field_validator(
        "temperature_mean_c", "temperature_min_c", "temperature_max_c",
        "humidity_mean_pct", "rainfall_mm", "heat_index_mean_c",
        "wind_speed_mean_kph", "cloud_cover_mean_pct", "population",
        "customer_count", "available_capacity_kw", mode="before"
    )
    @classmethod
    def reject_nan_and_infinite(cls, value):
        if value is None:
            return value
        if isinstance(value, (int, float)) and not math.isfinite(value):
            raise ValueError("Value must be a finite number; NaN and infinity are not allowed.")
        return value


class ForecastSevenDayRequest(BaseModel):
    municipality: str
    start_date: date
    latitude: float | None = Field(default=None, ge=5.0, le=8.0)
    longitude: float | None = Field(default=None, ge=123.0, le=126.0)
    days: list[DailyWeatherInput] = Field(..., min_length=7, max_length=7)

    @field_validator("municipality")
    @classmethod
    def normalize_location(cls, value: str) -> str:
        return normalize_municipality(value)

    @field_validator("days")
    @classmethod
    def days_must_be_seven_consecutive_dates(cls, days: list[DailyWeatherInput], info):
        start = info.data.get("start_date")
        if start is None:
            return days
        expected = [start + timedelta(days=index) for index in range(7)]
        actual = [item.date for item in days]
        if actual != expected:
            raise ValueError(
                "'days' must contain exactly seven consecutive dates beginning on start_date. "
                f"Expected {[item.isoformat() for item in expected]}."
            )
        return days


class ForecastCurrentDayRequest(BaseModel):
    """Arbitrary one-day scenario with an explicit recursive bridge from model history."""

    municipality: str
    target_date: date
    latitude: float | None = Field(default=None, ge=5.0, le=8.0)
    longitude: float | None = Field(default=None, ge=123.0, le=126.0)
    bridge_weather_source: str | None = Field(default=None, max_length=500)
    bridge_used_climatology_fallback: bool = False
    days: list[DailyWeatherInput] = Field(..., min_length=1, max_length=800)

    @field_validator("municipality")
    @classmethod
    def normalize_location(cls, value: str) -> str:
        return normalize_municipality(value)

    @model_validator(mode="after")
    def validate_bridge_calendar(self):
        dates = [item.date for item in self.days]
        if not dates:
            return self
        expected = [dates[0] + timedelta(days=index) for index in range(len(dates))]
        if dates != expected:
            raise ValueError("'days' must contain consecutive dates with no gaps or duplicates.")
        if dates[-1] != self.target_date:
            raise ValueError(
                "The final supplied weather date must equal target_date. "
                f"Expected {self.target_date.isoformat()}."
            )
        return self

class ForecastCurrentWeekRequest(BaseModel):
    """Arbitrary seven-day scenario with an explicit recursive bridge from model history."""

    municipality: str
    target_start_date: date
    latitude: float | None = Field(default=None, ge=5.0, le=8.0)
    longitude: float | None = Field(default=None, ge=123.0, le=126.0)
    bridge_weather_source: str | None = Field(default=None, max_length=500)
    bridge_used_climatology_fallback: bool = False
    days: list[DailyWeatherInput] = Field(..., min_length=7, max_length=800)

    @field_validator("municipality")
    @classmethod
    def normalize_location(cls, value: str) -> str:
        return normalize_municipality(value)

    @model_validator(mode="after")
    def validate_bridge_calendar(self):
        dates = [item.date for item in self.days]
        if not dates:
            return self
        expected = [dates[0] + timedelta(days=index) for index in range(len(dates))]
        if dates != expected:
            raise ValueError("'days' must contain consecutive dates with no gaps or duplicates.")
        if self.target_start_date < dates[0]:
            raise ValueError("target_start_date cannot be earlier than the first supplied weather date.")
        target_end = self.target_start_date + timedelta(days=6)
        if dates[-1] != target_end:
            raise ValueError(
                "The final supplied weather date must be six days after target_start_date. "
                f"Expected {target_end.isoformat()}."
            )
        return self

