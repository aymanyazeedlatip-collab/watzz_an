"""Inspect every municipality-aware production artifact without starting FastAPI."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.services.model_loader import load_production_bundle  # noqa: E402


def main() -> None:
    print("Loading municipality production model bundle...\n")
    bundle = load_production_bundle()

    for name, status in sorted(bundle.statuses.items()):
        state = "OK" if status.loaded else "FAILED"
        print(f"[{state:6s}] {name:42s} file={status.artifact_file}")
        if status.detail:
            print(f"         detail: {status.detail}")

    print("\nReadiness summary")
    print(f"  Municipality MLR:              {bundle.mlr_ready}")
    print(f"  Direct SARIMA models:          {len(bundle.direct_sarima)}/12")
    print(f"  Residual SARIMA models:        {len(bundle.residual_sarima)}/12")
    print(f"  Hybrid ready:                  {bundle.hybrid_ready}")
    print(f"  Peak estimator:                {bundle.peak_estimator_ready}")
    print(f"  Recommendation classifier:     {bundle.recommendation_ready}")
    print(f"  Production history:            {bundle.history_ready}")
    print(f"  ALL PRODUCTION READY:          {bundle.production_ready}")

    if not bundle.production_ready:
        sys.exit(1)


if __name__ == "__main__":
    main()
