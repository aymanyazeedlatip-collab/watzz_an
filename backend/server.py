"""Vercel ASGI entrypoint for WATTZAN.

This file intentionally does three things before importing the full system:
1. Restricts scientific-library thread pools for Vercel's 1-vCPU runtime.
2. Adds the backend folder to sys.path for the existing ``app.*`` imports.
3. Converts ordinary Python import failures into a small diagnostic FastAPI app
   instead of allowing Vercel to show only FUNCTION_INVOCATION_FAILED.
"""
from __future__ import annotations

import os
import sys
import traceback
from pathlib import Path

# Scientific Python libraries may otherwise create many worker threads during a
# cold start. Vercel Hobby functions currently provide one vCPU, so one worker
# per native library is the safer and more predictable setting.
for variable in (
    "OPENBLAS_NUM_THREADS",
    "OMP_NUM_THREADS",
    "MKL_NUM_THREADS",
    "NUMEXPR_NUM_THREADS",
    "VECLIB_MAXIMUM_THREADS",
    "BLIS_NUM_THREADS",
):
    os.environ.setdefault(variable, "1")
os.environ.setdefault("MALLOC_ARENA_MAX", "2")

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_IMPORT_ERROR: BaseException | None = None
_IMPORT_TRACEBACK = ""

try:
    from app.main import app  # noqa: E402,F401
except BaseException as exc:  # pragma: no cover - deployment safety net
    # Keep a minimal FastAPI process alive so the real import error can be read
    # from a browser endpoint. Never include environment-variable values.
    _IMPORT_ERROR = exc
    _IMPORT_TRACEBACK = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))

    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI(title="WATTZAN deployment diagnostics", version="16.3.1")

    def _safe_error_payload() -> dict:
        lines = [line for line in _IMPORT_TRACEBACK.splitlines() if line.strip()]
        return {
            "status": "startup_import_failed",
            "application": "WATTZAN",
            "exception_type": type(_IMPORT_ERROR).__name__ if _IMPORT_ERROR else "UnknownError",
            "message": str(_IMPORT_ERROR) if _IMPORT_ERROR else "Unknown startup import error.",
            "traceback_tail": lines[-18:],
            "python_version": sys.version.split()[0],
            "vercel": bool(os.getenv("VERCEL")),
            "backend_directory_exists": BACKEND_DIR.exists(),
        }

    @app.get("/api/health")
    async def failed_health() -> JSONResponse:
        return JSONResponse(status_code=503, content=_safe_error_payload())

    @app.get("/api/deployment-diagnostics")
    async def deployment_diagnostics() -> JSONResponse:
        return JSONResponse(status_code=503, content=_safe_error_payload())
