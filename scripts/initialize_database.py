"""Standalone database initialization script.

Creates the SQLite database file and tables (and registers the default
dataset as active, on a brand-new database) without starting the web
server. `run_server.bat` already does this automatically on startup,
so you normally don't need to run this by hand - it's here for
troubleshooting or for setting things up ahead of time.

Run from the backend/ folder with your virtual environment active:

    python scripts/initialize_database.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlmodel import Session  # noqa: E402

from app.database import engine, init_db  # noqa: E402
from app.services.preprocessing_service import ensure_default_dataset_registered  # noqa: E402


def main() -> None:
    print("Creating database tables if needed...")
    init_db()
    with Session(engine) as session:
        ensure_default_dataset_registered(session)
    print("Database is ready.")


if __name__ == "__main__":
    main()
