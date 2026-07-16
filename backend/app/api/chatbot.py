"""Gemini assistant API for context-aware WATTZAN explanations."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlmodel import Session

from app.config import refresh_gemini_settings, settings
from app.database import get_session
from app.schemas.chatbot import ChatbotMessageRequest, ChatbotMessageResponse
from app.services import chatbot_service, history_service
from app.utils.exceptions import ExternalServiceError, WattzanError
from app.utils.logging_config import get_logger

logger = get_logger("wattzan.chatbot.api")

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])


def _safe_iso(value) -> str | None:
    if value is None:
        return None
    isoformat = getattr(value, "isoformat", None)
    if callable(isoformat):
        try:
            return isoformat()
        except Exception:
            return str(value)
    return str(value)


def _compact_forecast(record) -> dict:
    """Build chatbot context without letting one damaged history row break chat."""
    return {
        "municipality": getattr(record, "municipality", None),
        "forecast_date": _safe_iso(getattr(record, "forecast_date", None)),
        "forecast_type": getattr(record, "forecast_type", None),
        "mlr_prediction_kwh": getattr(record, "mlr_prediction_kwh", None),
        "sarima_prediction_kwh": getattr(record, "sarima_prediction_kwh", None),
        "hybrid_prediction_kwh": getattr(record, "hybrid_prediction_kwh", None),
        "selected_prediction_kwh": getattr(record, "selected_prediction_kwh", None),
        "estimated_peak_demand_kw": getattr(record, "estimated_peak_demand_kw", None),
        "available_capacity_kw": getattr(record, "available_capacity_kw", None),
        "capacity_utilization_pct": getattr(record, "capacity_utilization_pct", None),
        "demand_level": getattr(record, "demand_level", None),
        "reason_codes": getattr(record, "reason_codes", None),
        "recommended_actions": getattr(record, "recommended_actions", None),
        "model_version": getattr(record, "model_version", None),
        "created_at": _safe_iso(getattr(record, "created_at", None)),
    }


@router.get("/status")
def chatbot_status() -> dict:
    diagnostics = refresh_gemini_settings()
    return {
        "configured": settings.gemini_configured,
        "available": settings.gemini_configured,
        "provider": "Google Gemini API",
        "model": chatbot_service.model_candidates()[0],
        "configured_model": settings.gemini_model,
        "fallback_models": chatbot_service.model_candidates()[1:],
        "api_key_location": "backend/.env",
        "context_mode": "Live WATTZAN dashboard snapshot plus recent saved forecasts",
        "max_output_tokens": settings.gemini_max_output_tokens,
        "retry_output_tokens": settings.gemini_retry_output_tokens,
        "thinking_level": settings.gemini_thinking_level,
        "configuration_source": diagnostics.get("configuration_source"),
        "env_files_found": diagnostics.get("existing_files", []),
        "key_length": diagnostics.get("key_length", 0),
        "key_only_in_env_example": diagnostics.get("key_only_in_env_example", False),
        "placeholder_files": diagnostics.get("placeholder_files", []),
    }


@router.post("/message", response_model=ChatbotMessageResponse)
async def chatbot_message(
    payload: ChatbotMessageRequest,
    request: Request,
    session: Session = Depends(get_session),
) -> dict:
    refresh_gemini_settings()
    server_context = {
        "backend_health": {
            "database_connected": bool(getattr(request.app.state, "database_connected", False)),
            "models_loaded": bool(getattr(request.app.state, "models_loaded", False)),
            "application_version": settings.app_version,
        },
        "recent_saved_forecasts": [],
    }

    try:
        recent_records = history_service.list_forecasts(session, limit=12)
        server_context["recent_saved_forecasts"] = [
            _compact_forecast(record) for record in recent_records
        ]
    except Exception as exc:
        # Chat should still work even if one optional history/context read fails.
        logger.exception("Could not attach recent forecast history to chatbot context.")
        server_context["recent_saved_forecasts_error"] = type(exc).__name__

    merged_context = {
        "frontend_dashboard_snapshot": payload.context or {},
        "server_verified_snapshot": server_context,
    }

    try:
        return await chatbot_service.generate_reply(
            message=payload.message,
            history=payload.history,
            context=merged_context,
            current_page=payload.current_page,
        )
    except WattzanError:
        raise
    except Exception as exc:
        logger.exception("Unexpected chatbot processing failure.")
        raise ExternalServiceError(
            "The WATTZAN assistant could not process this message.",
            details=(
                f"{type(exc).__name__}. Check "
                "backend/data/processed/logs/wattzan.log for the full traceback."
            ),
        ) from exc
