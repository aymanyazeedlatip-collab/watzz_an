"""Vercel ASGI entrypoint for WATTZAN.

Vercel imports ``backend.server:app``.  The existing application uses
``app.*`` imports while running locally from the backend directory, so this
entrypoint adds that directory to ``sys.path`` before importing the FastAPI app.
"""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402,F401
