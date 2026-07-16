"""Application-wide logging setup.

WHAT THIS FILE DOES (plain language):
"Logging" means writing a running diary of what the server did, to a
file on disk, so that if something goes wrong you (or I) can look back
and see exactly what happened, without needing to reproduce the error
live. This file turns that diary on, once, when the app starts.

We deliberately never log full uploaded datasets or secret values -
only short status messages (e.g. "model loaded", "upload failed:
invalid column").
"""
from __future__ import annotations

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "processed" / "logs"
LOG_FILE = LOG_DIR / "wattzan.log"


def configure_logging() -> None:
    """Set up logging. Vercel uses console logs; local runs also use a file."""
    is_vercel = bool(os.getenv("VERCEL"))
    if not is_vercel:
        LOG_DIR.mkdir(parents=True, exist_ok=True)

    root_logger = logging.getLogger()
    if root_logger.handlers:
        # Already configured (e.g. during test runs that import main twice).
        return

    root_logger.setLevel(logging.INFO)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # Vercel Functions should log to stdout/stderr. Local installations keep
    # the rotating file log used by the existing troubleshooting guides.
    if not is_vercel:
        file_handler = RotatingFileHandler(
            LOG_FILE, maxBytes=2_000_000, backupCount=5, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
