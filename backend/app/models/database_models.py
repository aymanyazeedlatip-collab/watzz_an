"""SQLite table definitions for municipality-aware forecast history and datasets."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Column, LargeBinary
from sqlmodel import Field, SQLModel


class ForecastRecord(SQLModel, table=True):
    __tablename__ = "forecast_records"

    id: str = Field(primary_key=True)
    municipality: Optional[str] = Field(default=None, index=True)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    forecast_date: date
    forecast_type: str = Field(index=True)

    mlr_prediction_kwh: Optional[float] = None
    sarima_prediction_kwh: Optional[float] = None
    hybrid_prediction_kwh: Optional[float] = None
    selected_prediction_kwh: float

    estimated_peak_demand_kw: Optional[float] = None
    available_capacity_kw: Optional[float] = None
    capacity_utilization_pct: Optional[float] = None
    demand_level: str

    reason_codes: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    recommended_actions: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    model_version: str
    input_data_json: dict = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DatasetRecord(SQLModel, table=True):
    __tablename__ = "dataset_records"

    id: str = Field(primary_key=True)
    original_file_name: str
    stored_file_name: str
    # Uploaded CSV bytes are stored in the database for Vercel deployments,
    # where the function filesystem is not persistent. Built-in data remains
    # bundled as a read-only CSV and leaves this field null.
    file_content: Optional[bytes] = Field(
        default=None, sa_column=Column(LargeBinary, nullable=True)
    )
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    row_count: int = 0
    validation_status: str
    validation_summary_json: dict = Field(default_factory=dict, sa_column=Column(JSON))
    is_active: bool = Field(default=False, index=True)
    data_classification: str = (
        "RESEARCH-GRADE SYNTHETIC / NOT OFFICIAL MUNICIPAL DAILY UTILITY DATA"
    )
