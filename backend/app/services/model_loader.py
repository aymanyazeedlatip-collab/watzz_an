"""Load municipality-aware WATTZAN model artifacts once at application startup."""
from __future__ import annotations

import csv
import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX

from app.config import settings
from app.services.municipality_catalog import MUNICIPALITIES
from app.utils.logging_config import get_logger

logger = get_logger(__name__)

PRODUCTION_ARTIFACT_FILES = {
    "mlr": "municipality_mlr_production.joblib",
    "peak_estimator": "municipality_peak_estimator.joblib",
    "recommendation_classifier": "municipality_recommendation_classifier.joblib",
    "production_history": "municipality_production_history.csv",
}


def safe_name(value: str) -> str:
    return value.lower().replace(" ", "_").replace("-", "_").replace(".", "")


@dataclass
class ComponentStatus:
    name: str
    artifact_file: str | None
    loaded: bool
    detail: str | None = None


@dataclass
class ModelBundle:
    mlr: Any = None
    peak_estimator: Any = None
    recommendation_classifier: Any = None
    direct_sarima: dict[str, Any] = field(default_factory=dict)
    residual_sarima: dict[str, Any] = field(default_factory=dict)
    production_history: pd.DataFrame | None = None
    feature_config: dict | None = None
    sarima_config: dict | None = None
    statuses: dict[str, ComponentStatus] = field(default_factory=dict)

    @property
    def mlr_ready(self) -> bool:
        return bool(self.statuses.get("mlr") and self.statuses["mlr"].loaded)

    @property
    def sarima_ready(self) -> bool:
        return len(self.direct_sarima) == len(MUNICIPALITIES)

    @property
    def hybrid_ready(self) -> bool:
        return self.mlr_ready and len(self.residual_sarima) == len(MUNICIPALITIES)

    @property
    def peak_estimator_ready(self) -> bool:
        return bool(
            self.statuses.get("peak_estimator")
            and self.statuses["peak_estimator"].loaded
        )

    @property
    def recommendation_ready(self) -> bool:
        return bool(
            self.statuses.get("recommendation_classifier")
            and self.statuses["recommendation_classifier"].loaded
        )

    @property
    def history_ready(self) -> bool:
        return self.production_history is not None and not self.production_history.empty

    @property
    def production_ready(self) -> bool:
        return (
            self.mlr_ready
            and self.sarima_ready
            and self.hybrid_ready
            and self.peak_estimator_ready
            and self.recommendation_ready
            and self.history_ready
        )


def _load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def load_feature_config() -> dict:
    return _load_json(settings.feature_config_dir / "feature_configuration.json")


def load_sarima_config() -> dict:
    return _load_json(settings.feature_config_dir / "selected_sarima_configurations.json")


def _expected_mlr_features(feature_config: dict) -> list[str]:
    return list(feature_config.get("categorical_features", [])) + list(
        feature_config.get("numeric_features", [])
    )


def _load_pipeline(bundle: ModelBundle, key: str, filename: str, expected: list[str] | None) -> Any:
    path = settings.production_artifacts_dir / filename
    try:
        pipeline = joblib.load(path)
        detail = None
        actual = list(getattr(pipeline, "feature_names_in_", []))
        if expected is not None and actual and actual != expected:
            detail = f"Feature mismatch. Artifact expects {actual}; configuration declares {expected}."
        bundle.statuses[key] = ComponentStatus(key, filename, detail is None, detail)
        if detail:
            logger.error("%s", detail)
            return None
        return pipeline
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to load %s", filename)
        bundle.statuses[key] = ComponentStatus(key, filename, False, str(exc))
        return None


def _reconstruct_sarima(artifact_path: Path, history: pd.DataFrame) -> Any:
    artifact = _load_json(artifact_path)
    municipality = artifact["municipality"]
    location_history = history[history["municipality"] == municipality].sort_values("date")
    if location_history.empty:
        raise ValueError(f"No production history found for {municipality}.")

    if artifact["series_type"] == "direct_consumption":
        values = np.log(location_history["consumption_kwh"].astype(float).values)
        series_name = "consumption_kwh"
    elif artifact["series_type"] == "mlr_residual":
        values = location_history["production_mlr_residual_kwh"].astype(float).values
        series_name = "production_mlr_residual_kwh"
    else:
        raise ValueError(f"Unsupported SARIMA series type: {artifact['series_type']}")

    index = pd.DatetimeIndex(location_history["date"], freq="D")
    series = pd.Series(values, index=index, name=series_name)
    model = SARIMAX(
        series,
        order=tuple(artifact["order"]),
        seasonal_order=tuple(artifact["seasonal_order"]),
        enforce_stationarity=False,
        enforce_invertibility=False,
    )
    result = model.filter(np.asarray(artifact["parameters"], dtype=float))
    expected_last = pd.Timestamp(artifact["last_observation_date"])
    actual_last = pd.Timestamp(series.index[-1])
    if actual_last != expected_last:
        raise ValueError(
            f"History ends {actual_last.date()}, but artifact expects {expected_last.date()}."
        )
    return result


def load_production_bundle() -> ModelBundle:
    bundle = ModelBundle()

    try:
        bundle.feature_config = load_feature_config()
        bundle.statuses["feature_config"] = ComponentStatus(
            "feature_config", "feature_configuration.json", True
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Could not load municipality feature configuration")
        bundle.statuses["feature_config"] = ComponentStatus(
            "feature_config", "feature_configuration.json", False, str(exc)
        )
        bundle.feature_config = {}

    try:
        bundle.sarima_config = load_sarima_config()
        bundle.statuses["sarima_config"] = ComponentStatus(
            "sarima_config", "selected_sarima_configurations.json", True
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Could not load SARIMA configuration")
        bundle.statuses["sarima_config"] = ComponentStatus(
            "sarima_config", "selected_sarima_configurations.json", False, str(exc)
        )
        bundle.sarima_config = {}

    history_path = settings.production_artifacts_dir / PRODUCTION_ARTIFACT_FILES["production_history"]
    try:
        bundle.production_history = pd.read_csv(history_path, parse_dates=["date"])
        bundle.production_history = bundle.production_history.sort_values(
            ["municipality", "date"]
        ).reset_index(drop=True)
        bundle.statuses["production_history"] = ComponentStatus(
            "production_history", PRODUCTION_ARTIFACT_FILES["production_history"], True
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Could not load municipality production history")
        bundle.statuses["production_history"] = ComponentStatus(
            "production_history", PRODUCTION_ARTIFACT_FILES["production_history"], False, str(exc)
        )

    feature_config = bundle.feature_config or {}
    bundle.mlr = _load_pipeline(
        bundle,
        "mlr",
        PRODUCTION_ARTIFACT_FILES["mlr"],
        _expected_mlr_features(feature_config),
    )
    bundle.peak_estimator = _load_pipeline(
        bundle,
        "peak_estimator",
        PRODUCTION_ARTIFACT_FILES["peak_estimator"],
        list(feature_config.get("peak_categorical_features", []))
        + list(feature_config.get("peak_numeric_features", [])),
    )
    bundle.recommendation_classifier = _load_pipeline(
        bundle,
        "recommendation_classifier",
        PRODUCTION_ARTIFACT_FILES["recommendation_classifier"],
        list(feature_config.get("recommendation_categorical_features", []))
        + list(feature_config.get("recommendation_numeric_features", [])),
    )

    if bundle.production_history is not None:
        for municipality in MUNICIPALITIES:
            slug = safe_name(municipality)
            direct_file = f"{slug}_direct_sarima_production.json"
            residual_file = f"{slug}_residual_sarima_production.json"
            try:
                bundle.direct_sarima[municipality] = _reconstruct_sarima(
                    settings.production_artifacts_dir / direct_file,
                    bundle.production_history,
                )
                bundle.statuses[f"direct_sarima:{municipality}"] = ComponentStatus(
                    f"direct_sarima:{municipality}", direct_file, True
                )
            except Exception as exc:  # noqa: BLE001
                logger.exception("Failed to reconstruct direct SARIMA for %s", municipality)
                bundle.statuses[f"direct_sarima:{municipality}"] = ComponentStatus(
                    f"direct_sarima:{municipality}", direct_file, False, str(exc)
                )

            try:
                bundle.residual_sarima[municipality] = _reconstruct_sarima(
                    settings.production_artifacts_dir / residual_file,
                    bundle.production_history,
                )
                bundle.statuses[f"residual_sarima:{municipality}"] = ComponentStatus(
                    f"residual_sarima:{municipality}", residual_file, True
                )
            except Exception as exc:  # noqa: BLE001
                logger.exception("Failed to reconstruct residual SARIMA for %s", municipality)
                bundle.statuses[f"residual_sarima:{municipality}"] = ComponentStatus(
                    f"residual_sarima:{municipality}", residual_file, False, str(exc)
                )

    logger.info(
        "Municipality model bundle loaded: mlr=%s direct_sarima=%d/12 residual_sarima=%d/12 "
        "peak=%s recommendations=%s production_ready=%s",
        bundle.mlr_ready,
        len(bundle.direct_sarima),
        len(bundle.residual_sarima),
        bundle.peak_estimator_ready,
        bundle.recommendation_ready,
        bundle.production_ready,
    )
    return bundle


def read_json_metric_file(filename: str) -> dict | None:
    path = settings.metrics_dir / filename
    if not path.exists():
        logger.warning("Metrics file not found: %s", filename)
        return None
    return _load_json(path)


def read_csv_metric_file(filename: str) -> list[dict] | None:
    path = settings.metrics_dir / filename
    if not path.exists():
        logger.warning("Metrics file not found: %s", filename)
        return None
    with open(path, "r", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))
