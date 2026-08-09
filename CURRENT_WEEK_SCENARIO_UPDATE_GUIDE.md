# WATTZAN Current-Week Scenario Update

## Why the sequential-date message appeared

The strict forecasting endpoints use municipality-specific lag features and SARIMA state. If Tacurong City has stored model history through 2025-01-01, the next strict date must be 2025-01-02. Jumping directly to July 2026 would leave hundreds of missing electricity-consumption values needed for lag-1, lag-7, lag-30, rolling means, and SARIMA state.

This update does not remove that scientific safeguard.

## New behavior

When the user selects Seven-day Forecast, changes the start date to a later current week, and clicks **Fetch weather & run seven-day forecast**, the frontend now:

1. Requests the municipality's next strict model date from `/api/forecast/next-date`.
2. Detects the missing date gap.
3. Downloads date-matched Open-Meteo weather in bounded 90-day chunks.
4. Sends the full consecutive weather sequence to `/api/forecast/current-week`.
5. Recursively creates in-memory electricity predictions for the missing dates.
6. Returns and saves only the requested final seven days.

The bridge predictions are not inserted as strict one-day model history. Therefore, the normal sequential endpoint remains unchanged and scientifically auditable.

## Important limitation

A long recursive bridge is a development scenario, not a replacement for actual electricity records. Errors can accumulate over hundreds of predicted days. The correct research and operational approach is to upload actual municipality electricity consumption through the day before the target week.

## Installation using the update ZIP

1. Stop `run_server.bat` with Ctrl+C.
2. Back up the entire current WATTZAN folder.
3. Extract `WATTZAN_Current_Week_Scenario_Update.zip`.
4. Copy its `backend` and `frontend` folders into the current project.
5. Choose **Replace the files in the destination** when Windows asks.
6. Do not delete `backend/data/processed/wattzan.db`; it contains current forecast history.
7. Restart `backend/run_server.bat`.
8. Open `http://127.0.0.1:8000` and press Ctrl+F5.

## How to run this week's scenario

1. Open Forecast > Short-term Forecast.
2. Select Seven-day Forecast.
3. Select a municipality on the map.
4. Set the start date to the desired current-week date.
5. Click **Fetch weather & run seven-day forecast**.
6. The status will show weather-segment progress and the number of missing electricity days being bridged.
7. Wait for the model request to finish. A 500-600 day bridge normally requires several weather requests and one larger local inference request.
8. Review the seven target-day results and the scenario limitation notice.

## API additions

- `GET /api/forecast/next-date?municipality=Tacurong%20City`
- `POST /api/forecast/current-week`

## Verification

- Python tests: 32 passed.
- Full 567-day backend bridge benchmark: completed successfully in under 2 seconds on the test environment, excluding external weather download time.
- JavaScript syntax check: passed.
- UTC date arithmetic tests: passed.
- Existing strict one-day and seven-day behavior remains unchanged.
