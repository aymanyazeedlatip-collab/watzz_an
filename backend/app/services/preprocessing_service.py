"""Load, summarize, and describe the active municipality-level dataset."""
from __future__ import annotations

import uuid
from io import BytesIO
from pathlib import Path
from threading import RLock

import pandas as pd
from sqlmodel import Session, select

from app.config import settings
from app.models.database_models import DatasetRecord
from app.services.municipality_catalog import MUNICIPALITIES, normalize_municipality
from app.utils.logging_config import get_logger

logger = get_logger(__name__)

DEFAULT_DATASET_FILENAME = "wattzan_municipality_model_dataset.csv"
TARGET_COLUMN = "consumption_kwh"
COVERAGE_AREA = "12 municipalities/city, Sultan Kudarat, Philippines"
DATA_CLASSIFICATION = (
    "RESEARCH-GRADE SYNTHETIC MUNICIPALITY-LEVEL DATA / NOT OFFICIAL OBSERVED DAILY UTILITY DATA"
)

# Parsing the 20k+ row active CSV on every API request adds avoidable latency,
# especially on Vercel where an uploaded dataset may live in Postgres as bytes.
# Keep one immutable parsed dataframe per warm process and invalidate it whenever
# the active dataset changes. Callers already copy/filter before mutating it.
_ACTIVE_FRAME_CACHE_LOCK = RLock()
_ACTIVE_FRAME_CACHE_KEY: tuple | None = None
_ACTIVE_FRAME_CACHE: pd.DataFrame | None = None


def invalidate_active_dataframe_cache() -> None:
    global _ACTIVE_FRAME_CACHE_KEY, _ACTIVE_FRAME_CACHE
    with _ACTIVE_FRAME_CACHE_LOCK:
        _ACTIVE_FRAME_CACHE_KEY = None
        _ACTIVE_FRAME_CACHE = None


def _active_record_cache_key(record: DatasetRecord) -> tuple:
    return (
        record.id,
        record.stored_file_name,
        int(record.row_count or 0),
        record.uploaded_at.isoformat() if record.uploaded_at else None,
        len(record.file_content) if record.file_content else 0,
    )


def ensure_default_dataset_registered(session: Session) -> None:
    """Register and activate the municipality dataset, even when an old province record exists."""
    default_path = settings.default_data_dir / DEFAULT_DATASET_FILENAME
    if not default_path.exists():
        logger.warning("Default municipality dataset not found at %s", default_path)
        return

    existing_default = session.exec(
        select(DatasetRecord).where(DatasetRecord.original_file_name == DEFAULT_DATASET_FILENAME)
    ).first()
    if existing_default is not None:
        if not existing_default.is_active:
            for record in session.exec(select(DatasetRecord).where(DatasetRecord.is_active == True)):  # noqa: E712
                record.is_active = False
                session.add(record)
            existing_default.is_active = True
            session.add(existing_default)
            session.commit()
            invalidate_active_dataframe_cache()
        return

    frame = pd.read_csv(default_path)
    dates = pd.to_datetime(frame["date"], errors="coerce").dropna()
    for record in session.exec(select(DatasetRecord).where(DatasetRecord.is_active == True)):  # noqa: E712
        record.is_active = False
        session.add(record)

    record = DatasetRecord(
        id=uuid.uuid4().hex,
        original_file_name=DEFAULT_DATASET_FILENAME,
        stored_file_name=DEFAULT_DATASET_FILENAME,
        start_date=dates.min().date() if not dates.empty else None,
        end_date=dates.max().date() if not dates.empty else None,
        row_count=len(frame),
        validation_status="PASS",
        validation_summary_json={
            "note": "Built-in municipality-aware training dataset.",
            "municipality_count": int(frame["municipality"].nunique()),
        },
        is_active=True,
        data_classification=DATA_CLASSIFICATION,
    )
    session.add(record)
    session.commit()
    invalidate_active_dataframe_cache()
    logger.info("Registered municipality default dataset (%d rows).", len(frame))


def get_active_dataset_record(session: Session) -> DatasetRecord | None:
    return session.exec(select(DatasetRecord).where(DatasetRecord.is_active == True)).first()  # noqa: E712


def resolve_dataset_path(record: DatasetRecord) -> Path:
    if record.stored_file_name == DEFAULT_DATASET_FILENAME:
        return settings.default_data_dir / DEFAULT_DATASET_FILENAME
    return settings.uploads_dir / record.stored_file_name


def load_active_dataframe(session: Session) -> tuple[pd.DataFrame | None, DatasetRecord | None]:
    global _ACTIVE_FRAME_CACHE_KEY, _ACTIVE_FRAME_CACHE

    record = get_active_dataset_record(session)
    if record is None:
        invalidate_active_dataframe_cache()
        return None, None

    cache_key = _active_record_cache_key(record)
    with _ACTIVE_FRAME_CACHE_LOCK:
        if _ACTIVE_FRAME_CACHE_KEY == cache_key and _ACTIVE_FRAME_CACHE is not None:
            return _ACTIVE_FRAME_CACHE, record

    if record.file_content:
        frame = pd.read_csv(BytesIO(record.file_content))
    else:
        path = resolve_dataset_path(record)
        if not path.exists():
            logger.error("Active dataset file is missing: %s", path)
            return None, record
        frame = pd.read_csv(path)
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    sort_columns = [column for column in ["municipality", "date"] if column in frame.columns]
    frame = frame.sort_values(sort_columns).reset_index(drop=True)

    with _ACTIVE_FRAME_CACHE_LOCK:
        _ACTIVE_FRAME_CACHE_KEY = cache_key
        _ACTIVE_FRAME_CACHE = frame
    return frame, record


def municipality_profiles(frame: pd.DataFrame) -> list[dict]:
    profiles: list[dict] = []
    for municipality in MUNICIPALITIES:
        group = frame[frame["municipality"] == municipality].sort_values("date")
        if group.empty:
            continue
        latest = group.iloc[-1]
        profiles.append(
            {
                "municipality": municipality,
                "municipality_type": latest.get("municipality_type"),
                "psgc_code": str(latest.get("psgc_code", "")),
                "latitude": float(latest.get("latitude")),
                "longitude": float(latest.get("longitude")),
                "climate_zone": latest.get("climate_zone"),
                "supply_system": latest.get("supply_system"),
                "grid_connected": bool(int(latest.get("grid_connected", 0))),
                "population": int(round(float(latest.get("population", 0)))),
                "customer_count": int(round(float(latest.get("customer_count", 0)))),
                "last_observed_date": group["date"].max().date().isoformat(),
            }
        )
    return profiles


def build_data_summary(frame: pd.DataFrame, municipality: str | None = None) -> dict:
    data = frame.copy()
    normalized = None
    if municipality:
        normalized = normalize_municipality(municipality)
        data = data[data["municipality"] == normalized].copy()
    if data.empty:
        return {"municipality": normalized, "date_coverage": {"total_rows": 0}}

    data["year"] = data["date"].dt.year
    data["month_period"] = data["date"].dt.to_period("M").astype(str)

    # Province summaries aggregate electricity by date before daily maxima/averages.
    if normalized is None:
        daily_energy = data.groupby("date", as_index=False)["consumption_kwh"].sum()
    else:
        daily_energy = data[["date", "consumption_kwh"]]

    annual = data.groupby("year")["consumption_kwh"].sum().round(2).to_dict()
    monthly = data.groupby("month_period")["consumption_kwh"].sum().round(2).to_dict()
    levels = data["demand_level"].value_counts().to_dict() if "demand_level" in data else {}

    annual_by_municipality = {}
    if normalized is None:
        pivot = data.groupby(["municipality", "year"])["consumption_kwh"].sum()
        for (location, year), value in pivot.items():
            annual_by_municipality.setdefault(str(location), {})[str(year)] = round(float(value), 2)

    return {
        "municipality": normalized,
        "scope": "municipality" if normalized else "province_aggregate",
        "annual_consumption_kwh": {str(key): float(value) for key, value in annual.items()},
        "monthly_consumption_kwh": {str(key): float(value) for key, value in monthly.items()},
        "annual_consumption_by_municipality_kwh": annual_by_municipality,
        "daily_average_consumption_kwh": round(float(daily_energy["consumption_kwh"].mean()), 2),
        "max_daily_consumption_kwh": round(float(daily_energy["consumption_kwh"].max()), 2),
        "min_daily_consumption_kwh": round(float(daily_energy["consumption_kwh"].min()), 2),
        "mean_temperature_c": round(float(data["temperature_mean_c"].mean()), 2),
        "total_rainfall_mm": round(float(data["rainfall_mm"].sum()), 2),
        "total_outage_minutes": float(data["outage_minutes"].sum()) if "outage_minutes" in data else None,
        "demand_level_counts": {str(key): int(value) for key, value in levels.items()},
        "municipality_count": int(data["municipality"].nunique()),
        "date_coverage": {
            "start_date": data["date"].min().date().isoformat(),
            "end_date": data["date"].max().date().isoformat(),
            "total_rows": len(data),
            "unique_days": int(data["date"].nunique()),
        },
    }
