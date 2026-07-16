"""Validation rules for municipality-day CSV datasets."""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

REQUIRED_COLUMNS = [
    "date", "municipality", "consumption_kwh", "temperature_mean_c",
    "humidity_mean_pct", "rainfall_mm", "population",
]
RECOMMENDED_COLUMNS = [
    "psgc_code", "climate_zone", "supply_system", "grid_connected",
    "temperature_min_c", "temperature_max_c", "heat_index_mean_c",
    "wind_speed_mean_kph", "cloud_cover_mean_pct", "peak_demand_kw",
    "available_capacity_kw", "outage_minutes", "customer_count", "is_holiday",
]
MIN_ROWS_PER_LOCATION = 365


@dataclass
class ValidationResult:
    valid: bool
    training_ready: bool
    total_rows: int
    start_date: str | None
    end_date: str | None
    missing_columns: list[str] = field(default_factory=list)
    missing_recommended_columns: list[str] = field(default_factory=list)
    missing_dates: list[str] = field(default_factory=list)
    missing_dates_by_municipality: dict[str, list[str]] = field(default_factory=dict)
    duplicate_dates: list[str] = field(default_factory=list)
    duplicate_municipality_dates: list[dict] = field(default_factory=list)
    missing_values: dict[str, int] = field(default_factory=dict)
    municipality_count: int = 0
    rows_per_municipality: dict[str, int] = field(default_factory=dict)
    errors: list[dict] = field(default_factory=list)
    warnings: list[dict] = field(default_factory=list)

    def to_payload(self) -> dict:
        return self.__dict__.copy()


def validate_dataframe(frame: pd.DataFrame) -> ValidationResult:
    errors: list[dict] = []
    warnings: list[dict] = []
    total_rows = len(frame)
    if total_rows == 0:
        return ValidationResult(False, False, 0, None, None, missing_columns=REQUIRED_COLUMNS,
            errors=[{"row": None, "column": None, "message": "The file has no data rows."}])

    missing_columns = [column for column in REQUIRED_COLUMNS if column not in frame.columns]
    missing_recommended = [column for column in RECOMMENDED_COLUMNS if column not in frame.columns]
    if missing_columns:
        return ValidationResult(False, False, total_rows, None, None,
            missing_columns=missing_columns, missing_recommended_columns=missing_recommended,
            errors=[{"row": None, "column": column, "message": "Required column is missing."} for column in missing_columns])

    data = frame.copy()
    parsed_dates = pd.to_datetime(data["date"], errors="coerce")
    invalid_dates = parsed_dates.isna()
    for index in data.index[invalid_dates][:100]:
        errors.append({"row": int(index) + 2, "column": "date", "message": "Invalid date value."})
    data["date"] = parsed_dates

    data["municipality"] = data["municipality"].astype(str).str.strip()
    blank_municipality = data["municipality"].eq("")
    if blank_municipality.any():
        errors.append({"row": None, "column": "municipality", "message": "Blank municipality values are not allowed."})

    duplicate_mask = data.duplicated(["municipality", "date"], keep=False) & data["date"].notna()
    duplicates = [
        {"municipality": str(row["municipality"]), "date": row["date"].date().isoformat()}
        for _, row in data.loc[duplicate_mask, ["municipality", "date"]].drop_duplicates().head(200).iterrows()
    ]
    if duplicates:
        errors.append({"row": None, "column": "municipality,date", "message": f"Found {len(duplicates)} duplicate municipality/date keys."})

    numeric_columns = ["consumption_kwh", "temperature_mean_c", "humidity_mean_pct", "rainfall_mm", "population"]
    for column in numeric_columns:
        data[column] = pd.to_numeric(data[column], errors="coerce")

    missing_values = {column: int(data[column].isna().sum()) for column in data.columns if int(data[column].isna().sum()) > 0}
    for column in REQUIRED_COLUMNS:
        count = int(data[column].isna().sum())
        if count:
            errors.append({"row": None, "column": column, "message": f"{count} required value(s) are missing or invalid."})

    rules = [
        ("consumption_kwh", data["consumption_kwh"] < 0, "Electricity consumption cannot be negative."),
        ("humidity_mean_pct", (data["humidity_mean_pct"] < 0) | (data["humidity_mean_pct"] > 100), "Humidity must be between 0 and 100."),
        ("rainfall_mm", data["rainfall_mm"] < 0, "Rainfall cannot be negative."),
        ("population", data["population"] <= 0, "Population must be positive."),
        ("temperature_mean_c", (data["temperature_mean_c"] < -10) | (data["temperature_mean_c"] > 55), "Mean temperature is outside the accepted range."),
    ]
    for column, mask, message in rules:
        if bool(mask.fillna(False).any()):
            errors.append({"row": None, "column": column, "message": message})

    missing_by_location: dict[str, list[str]] = {}
    rows_per_location: dict[str, int] = {}
    if not invalid_dates.all():
        for municipality, group in data.dropna(subset=["date"]).groupby("municipality"):
            group_dates = pd.DatetimeIndex(group["date"].drop_duplicates().sort_values())
            rows_per_location[str(municipality)] = len(group)
            expected = pd.date_range(group_dates.min(), group_dates.max(), freq="D")
            missing = [item.date().isoformat() for item in expected.difference(group_dates)]
            if missing:
                missing_by_location[str(municipality)] = missing[:500]
                warnings.append({"row": None, "column": "date", "message": f"{municipality} is missing {len(missing)} calendar date(s)."})

    flattened_missing = sorted({day for values in missing_by_location.values() for day in values})[:1000]
    municipality_count = int(data["municipality"].nunique())
    training_ready = (
        not errors
        and municipality_count >= 1
        and all(count >= MIN_ROWS_PER_LOCATION for count in rows_per_location.values())
        and not missing_by_location
    )
    if missing_recommended:
        warnings.append({"row": None, "column": None, "message": f"Recommended columns missing: {', '.join(missing_recommended)}"})

    valid_dates = data["date"].dropna()
    return ValidationResult(
        valid=not errors,
        training_ready=training_ready,
        total_rows=total_rows,
        start_date=valid_dates.min().date().isoformat() if not valid_dates.empty else None,
        end_date=valid_dates.max().date().isoformat() if not valid_dates.empty else None,
        missing_columns=missing_columns,
        missing_recommended_columns=missing_recommended,
        missing_dates=flattened_missing,
        missing_dates_by_municipality=missing_by_location,
        duplicate_dates=[item["date"] for item in duplicates],
        duplicate_municipality_dates=duplicates,
        missing_values=missing_values,
        municipality_count=municipality_count,
        rows_per_municipality=rows_per_location,
        errors=errors,
        warnings=warnings,
    )
