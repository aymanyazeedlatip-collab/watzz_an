"""GET /api/health - a quick "is the server alive and working" check."""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Request

from app.config import settings

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def get_health(request: Request) -> dict:
    app_state = request.app.state
    models_loaded = bool(getattr(app_state, "models_loaded", False))
    database_connected = bool(getattr(app_state, "database_connected", False))

    return {
        "status": "healthy",
        "application": settings.app_name,
        "version": settings.app_version,
        "timestamp": datetime.now(ZoneInfo(settings.app_timezone)).isoformat(),
        "timezone": settings.app_timezone,
        "database": "connected" if database_connected else "unavailable",
        "models_loaded": models_loaded,
    }
