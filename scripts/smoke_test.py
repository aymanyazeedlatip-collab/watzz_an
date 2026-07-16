"""Live municipality-aware smoke test.

Start backend/run_server.bat first. Then open another Command Prompt in the
project root and run:

    backend\.venv\Scripts\python.exe scripts\smoke_test.py
"""
from __future__ import annotations

import sys
from datetime import date, timedelta

import httpx

BASE_URL = "http://127.0.0.1:8000"
MUNICIPALITY = "Tacurong City"


def check(label: str, condition: bool, detail: str = "") -> None:
    status = "OK" if condition else "FAILED"
    print(f"[{status}] {label}")
    if detail:
        print(f"       {detail}")
    if not condition:
        sys.exit(1)


def main() -> None:
    with httpx.Client(base_url=BASE_URL, timeout=60) as client:
        health_response = client.get("/api/health")
        check("Health endpoint reachable", health_response.status_code == 200)
        health = health_response.json()
        check("Application is healthy", health.get("status") == "healthy")

        status = client.get("/api/models/status").json()
        check("Municipality production models loaded", status.get("production_ready") is True)

        active = client.get("/api/data/active").json()
        check("Location-aware dataset active", active.get("location_aware") is True)
        check("Twelve locations available", active.get("municipality_count") == 12)

        municipalities = client.get("/api/data/municipalities").json()
        names = [item["municipality"] for item in municipalities.get("municipalities", [])]
        check("Tacurong City profile available", MUNICIPALITY in names)
        profile = next(item for item in municipalities["municipalities"] if item["municipality"] == MUNICIPALITY)

        # Use the server's next expected date. A prior manual forecast may have
        # extended history beyond the active dataset's final observed date.
        history = client.get(
            "/api/forecast/history",
            params={"municipality": MUNICIPALITY, "forecast_type": "one_day_ahead", "limit": 1000},
        ).json().get("forecasts", [])
        if history:
            last_date = max(date.fromisoformat(item["forecast_date"]) for item in history)
        else:
            last_date = date.fromisoformat(profile["last_observed_date"])
        forecast_date = last_date + timedelta(days=1)

        payload = {
            "municipality": MUNICIPALITY,
            "forecast_date": forecast_date.isoformat(),
            "latitude": profile["latitude"],
            "longitude": profile["longitude"],
            "temperature_mean_c": 28.7,
            "temperature_min_c": 23.4,
            "temperature_max_c": 33.9,
            "humidity_mean_pct": 79.0,
            "rainfall_mm": 4.2,
            "heat_index_mean_c": 33.8,
            "wind_speed_mean_kph": 8.0,
            "cloud_cover_mean_pct": 64.0,
            "population": profile["population"],
            "customer_count": profile["customer_count"],
            "is_holiday": 0,
            "is_special_event": 0,
            "available_capacity_kw": 15000,
        }
        response = client.post("/api/forecast/one-day", json=payload)
        check("One-day forecast request succeeded", response.status_code == 200, response.text if response.status_code != 200 else "")
        forecast = response.json()
        check("Forecast used selected municipality", forecast.get("municipality") == MUNICIPALITY)
        check("Hybrid prediction returned", isinstance(forecast.get("hybrid_prediction_kwh"), (int, float)))
        check("Peak estimate returned", isinstance(forecast.get("estimated_peak_demand_kw"), (int, float)))

        record = client.get(f"/api/forecast/history/{forecast['forecast_id']}").json()
        check("Forecast stored with municipality", record.get("municipality") == MUNICIPALITY)

    print("\nAll municipality-aware smoke-test checks passed.")


if __name__ == "__main__":
    main()
