"""Standalone default-dataset validation script.

Runs the same validation rules the /api/data/validate endpoint uses,
directly against the built-in default dataset. Handy for confirming
the dataset is healthy before starting the server.

Run from the backend/ folder with your virtual environment active:

    python scripts/validate_default_dataset.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

import pandas as pd  # noqa: E402

from app.config import settings  # noqa: E402
from app.services import data_validator  # noqa: E402
from app.services.preprocessing_service import DEFAULT_DATASET_FILENAME  # noqa: E402


def main() -> None:
    path = settings.default_data_dir / DEFAULT_DATASET_FILENAME
    print(f"Validating {path} ...\n")
    df = pd.read_csv(path)
    result = data_validator.validate_dataframe(df)

    print(f"valid:          {result.valid}")
    print(f"training_ready: {result.training_ready}")
    print(f"total_rows:     {result.total_rows}")
    print(f"date_range:     {result.start_date} to {result.end_date}")
    print(f"errors:         {len(result.errors)}")
    print(f"warnings:       {len(result.warnings)}")

    for error in result.errors[:10]:
        print("  ERROR:", error)
    for warning in result.warnings[:10]:
        print("  WARNING:", warning)


if __name__ == "__main__":
    main()
