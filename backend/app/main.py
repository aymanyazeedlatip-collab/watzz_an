"""WATTZAN FastAPI application entry point.

WHAT THIS FILE DOES (plain language):
This is the file uvicorn (the program that actually runs the web
server) starts. It:
  1. Builds the FastAPI "app" object - the thing that knows how to
     answer web requests.
  2. Registers a "lifespan" function that runs once when the server
     starts (and once when it shuts down) to prepare logging, the
     database, and (from Phase 3 onward) the trained models.
  3. Registers every API route group ("router") - right now just
     health, more will be added in later phases.
  4. Turns our custom errors (see utils/exceptions.py) into clean JSON
     instead of raw Python tracebacks.
  5. Serves the frontend website (the HTML/CSS/JS in ../frontend) so
     that opening http://127.0.0.1:8000 shows the dashboard directly,
     with no separate frontend server needed.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from sqlmodel import Session

from app.api import (
    chatbot as chatbot_api,
    data as data_api,
    forecast as forecast_api,
    health,
    history as history_api,
    models as models_api,
)
from app.config import settings
from app.database import engine, init_db
from app.services import model_loader, preprocessing_service
from app.utils.exceptions import WattzanError
from app.utils.logging_config import configure_logging, get_logger

FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup: runs once, before the server accepts any requests ---
    configure_logging()
    logger = get_logger("wattzan.startup")
    logger.info("Starting %s v%s ...", settings.app_name, settings.app_version)

    # 1. Database: create the SQLite file and tables if they don't exist yet.
    try:
        init_db()
        app.state.database_connected = True
        with Session(engine) as session:
            preprocessing_service.ensure_default_dataset_registered(session)
    except Exception:
        logger.exception("Database initialization failed.")
        app.state.database_connected = False

    # 2. Model artifacts: load every production model into memory once.
    #    The SARIMA files are large, so we do this here at startup
    #    rather than reloading them on every single request.
    model_bundle = model_loader.load_production_bundle()
    app.state.model_bundle = model_bundle
    app.state.models_loaded = model_bundle.production_ready

    logger.info(
        "Startup complete. database_connected=%s models_loaded=%s",
        app.state.database_connected,
        app.state.models_loaded,
    )

    yield

    # --- Shutdown: runs once, when the server is stopping -------------
    logger.info("Shutting down %s.", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(WattzanError)
async def wattzan_error_handler(request: Request, exc: WattzanError) -> JSONResponse:
    logger = get_logger("wattzan.errors")
    logger.error("%s: %s (%s)", exc.code, exc.message, exc.details)
    return JSONResponse(status_code=exc.status_code, content=exc.to_payload())


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger = get_logger("wattzan.errors")
    # Full traceback goes to the log file only - never to the website.
    logger.exception("Unhandled server error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected server error occurred.",
                "details": None,
                "request_id": None,
            }
        },
    )


# --- API routes -----------------------------------------------------------
app.include_router(health.router)
app.include_router(chatbot_api.router)
app.include_router(models_api.router)
app.include_router(data_api.router)
app.include_router(forecast_api.router)
app.include_router(history_api.router)

# All backend routers are now registered. The frontend website
# (navigation, charts, forms) is built in a later phase.


# Vercel serves the frontend from public/ through its CDN. This redirect is a
# fallback for deployments where the root request reaches the Python Function.
if os.getenv("VERCEL"):
    @app.get("/", include_in_schema=False)
    async def vercel_root() -> RedirectResponse:
        return RedirectResponse(url="/index.html", status_code=307)


# --- Frontend static site ---------------------------------------------
# This serves frontend/index.html, styles.css, app.js, and assets/ at
# the site root, so the whole system runs from one address and one
# command. `html=True` makes "/" automatically load index.html.
if FRONTEND_DIR.exists() and not os.getenv("VERCEL"):
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
