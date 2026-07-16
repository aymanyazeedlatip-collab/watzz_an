"""Municipality model status and evaluation endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Request

from app.services import model_loader
from app.services.municipality_catalog import MUNICIPALITIES

router = APIRouter(prefix="/api/models", tags=["models"])


def _status(bundle: model_loader.ModelBundle, key: str) -> dict:
    component = bundle.statuses.get(key)
    if component is None:
        return {"loaded": False, "artifact_file": None, "detail": "Not attempted."}
    return {
        "loaded": component.loaded,
        "artifact_file": component.artifact_file,
        "detail": component.detail,
    }


@router.get("/status")
def get_model_status(request: Request) -> dict:
    bundle: model_loader.ModelBundle = request.app.state.model_bundle
    direct = {municipality: _status(bundle, f"direct_sarima:{municipality}") for municipality in MUNICIPALITIES}
    residual = {municipality: _status(bundle, f"residual_sarima:{municipality}") for municipality in MUNICIPALITIES}
    return {
        "architecture": "municipality_aware_hybrid_mlr_sarima",
        "mlr": _status(bundle, "mlr"),
        "sarima": {
            "loaded": bundle.sarima_ready,
            "loaded_count": len(bundle.direct_sarima),
            "required_count": len(MUNICIPALITIES),
            "municipality_artifacts": direct,
        },
        "hybrid": {
            "loaded": bundle.hybrid_ready,
            "residual_loaded_count": len(bundle.residual_sarima),
            "required_count": len(MUNICIPALITIES),
            "municipality_artifacts": residual,
        },
        "peak_demand_estimator": _status(bundle, "peak_estimator"),
        "recommendation_engine": {
            **_status(bundle, "recommendation_classifier"),
            "provisional": True,
            "expert_validation_required": True,
        },
        "production_history": _status(bundle, "production_history"),
        "municipalities": MUNICIPALITIES,
        "training_period": "2020-01-31 to 2022-12-31",
        "validation_period": "2023-01-01 to 2023-12-31",
        "test_period": "2024-01-01 to 2024-12-31",
        "target_variable": "consumption_kwh",
        "forecast_limitations": (
            "Published metrics represent rolling one-day-ahead municipality forecasts. "
            "Seven-day recursive forecasts can accumulate error. Ten-year results are planning scenarios, not daily SARIMA forecasts."
        ),
        "production_ready": bundle.production_ready,
        "synthetic_data_warning": (
            "The municipality-day records are research-grade synthetic data calibrated to official anchors. "
            "Replace them with observed utility and weather records before operational deployment."
        ),
    }


@router.get("/performance")
def get_model_performance() -> dict:
    training_report = model_loader.read_json_metric_file("training_report.json") or {}
    overall = model_loader.read_csv_metric_file("overall_forecasting_metrics_2024.csv") or []
    municipality = model_loader.read_csv_metric_file("municipality_forecasting_metrics_2024.csv") or []
    monthly = model_loader.read_csv_metric_file("monthly_forecasting_metrics_2024.csv") or []
    significance = model_loader.read_csv_metric_file("forecast_significance_tests.csv") or []
    peak = model_loader.read_csv_metric_file("peak_demand_metrics_2024.csv") or []
    aggregate = model_loader.read_csv_metric_file("province_aggregate_consistency_metrics_2024.csv") or []
    recommendation = model_loader.read_json_metric_file("recommendation_evaluation.json") or {}
    return {
        "model_metrics": overall,
        "best_test_model": "Hybrid MLR-SARIMA by R2, RMSE, and MAE; direct SARIMA by MAPE",
        "test_rows": training_report.get("split", {}).get("test_rows", 4392),
        "test_period": "2024-01-01 to 2024-12-31",
        "dataset_warning": training_report.get("scientific_warnings", []),
        "monthly_metrics": monthly,
        "municipality_metrics": municipality,
        "statistical_tests": significance,
        "peak_demand_metrics": peak,
        "province_aggregate_consistency": aggregate,
        "recommendation_metrics": recommendation,
        "training_report": training_report,
    }
