"""Small file-safety helpers.

WHAT THIS FILE DOES (plain language):
When a user uploads a file, its original name comes from their computer
and cannot be trusted - it could contain characters that try to escape
the uploads folder (a "path traversal" attack, e.g. a file literally
named "..\\..\\Windows\\System32\\evil.csv"). This file strips any
folder-like characters out and builds a safe, unique name to actually
save on disk, while still remembering the user's original name for
display purposes.
"""
from __future__ import annotations

import re
import uuid
from pathlib import Path

_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize_filename(original_name: str) -> str:
    """Return a filesystem-safe version of a base file name (no folders)."""
    # Path(...).name strips any directory components (e.g. "../../x.csv" -> "x.csv").
    base_name = Path(original_name).name
    base_name = _UNSAFE_CHARS.sub("_", base_name)
    if not base_name or base_name in {".", ".."}:
        base_name = "upload.csv"
    return base_name


def build_stored_filename(original_name: str) -> tuple[str, str]:
    """Return (dataset_id, stored_filename) - a unique, safe name to save under."""
    dataset_id = uuid.uuid4().hex
    safe_original = sanitize_filename(original_name)
    stored_filename = f"{dataset_id}_{safe_original}"
    return dataset_id, stored_filename


def is_within_directory(directory: Path, target: Path) -> bool:
    """Confirm `target` really is inside `directory` (defense in depth)."""
    try:
        target.resolve().relative_to(directory.resolve())
        return True
    except ValueError:
        return False
