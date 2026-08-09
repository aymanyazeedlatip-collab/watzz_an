# Beginner Integration Guide

This folder is a separate municipality-aware copy. Your original working
province project does not need to be overwritten.

## Part 1: Install the integrated project

1. Stop the old WATTZAN server by pressing `Ctrl+C` in its Command Prompt.
2. Keep the old WATTZAN folder as your backup.
3. Extract the municipality-integrated ZIP to an easy location such as Desktop.
4. Open the extracted folder.
5. Open its `backend` folder.
6. Double-click `run_server.bat`.
7. The first run creates `.venv` and installs Python libraries. Do not close it.
8. Wait until the window says `Application startup complete`.
9. Open `http://127.0.0.1:8000`.
10. Press `Ctrl+F5` once to clear older cached frontend files.

## Part 2: Confirm the models loaded

1. Open `http://127.0.0.1:8000/api/models/status`.
2. Confirm `production_ready` is `true`.
3. Confirm direct SARIMA and residual SARIMA each report 12 loaded locations.
4. Open `http://127.0.0.1:8000/api/data/municipalities`.
5. Confirm the response contains 12 municipality/city profiles.

## Part 3: Use the map and forecast

1. Open the WATTZAN dashboard.
2. Open **Long-Term Forecast** to display the Leaflet map.
3. Click inside Sultan Kudarat or press **Detect my location**.
4. Drag the pin when needed.
5. Confirm the detected municipality in the dropdown.
6. Open **Forecast**. The same municipality should already be selected.
7. For the first one-day run, use `2025-01-01`.
8. Fill in weather values and available capacity.
9. Click **Run one-day forecast**.
10. The result shows the municipal MLR, direct SARIMA, hybrid, peak demand,
    capacity utilization, demand level, and recommendations.

## Part 4: Why the next date changes

After you save a January 1 forecast for Tacurong City, the next Tacurong
one-day forecast must be January 2. Isulan can still start at January 1 because
forecast history is isolated by municipality.

To start over during development, stop the server and delete:

```text
backend\data\processed\wattzan.db
```

Restart the server. A new clean database will be created automatically. Do not
delete the CSV or the model artifact folders.

## Part 5: Run automated tests

1. Keep or stop the server; pytest starts its own test application.
2. Open Command Prompt in the `backend` folder.
3. Run:

```bat
.venv\Scripts\python.exe -m pytest -q
```

Expected result:

```text
29 passed
```

## Part 6: Test one endpoint manually in Swagger

1. Open `http://127.0.0.1:8000/docs`.
2. Open `POST /api/forecast/one-day`.
3. Click **Try it out**.
4. Paste this example:

```json
{
  "municipality": "Tacurong City",
  "forecast_date": "2025-01-01",
  "latitude": 6.6884,
  "longitude": 124.6786,
  "temperature_mean_c": 28.7,
  "temperature_min_c": 23.4,
  "temperature_max_c": 33.9,
  "humidity_mean_pct": 79,
  "rainfall_mm": 4.2,
  "heat_index_mean_c": 33.8,
  "wind_speed_mean_kph": 8,
  "cloud_cover_mean_pct": 64,
  "population": 118000,
  "customer_count": 30000,
  "is_holiday": 1,
  "holiday_name": "New Year's Day",
  "is_special_event": 0,
  "available_capacity_kw": 15000
}
```

5. Click **Execute**.
6. A successful response has status `200` and includes `municipality`,
   `mlr_prediction_kwh`, `sarima_prediction_kwh`, `hybrid_prediction_kwh`,
   `estimated_peak_demand_kw`, and `demand_level`.

## Troubleshooting

### The server says port 8000 is already in use

The old server is probably still open. Find its Command Prompt and press
`Ctrl+C`, then run the new launcher again.

### A forecast says the date must be sequential

Read the `details` value in the response. It tells you the exact expected date
for that municipality.

### The map tiles or chart icons do not appear

Leaflet, OpenStreetMap tiles, Chart.js, and Lucide are loaded from the internet.
Check the internet connection, then press `Ctrl+F5`.

### `production_ready` is false

From the project root, run:

```bat
backend\.venv\Scripts\python.exe scripts\inspect_artifacts.py
```

The failed artifact and exact loading error will be printed.

### You want to return to the old system

Close this server and run `run_server.bat` inside your original WATTZAN backup.
The two folders are independent.
