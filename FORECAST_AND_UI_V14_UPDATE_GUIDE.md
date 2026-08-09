# WATTZAN v14 Forecast and Interface Update

## Main forecast correction

The strict one-day endpoint still requires the next sequential date. A new endpoint handles a selected current or later date by recursively bridging the missing electricity-history days in memory:

- `POST /api/forecast/current-day`

Only the requested target date is saved. The synthetic bridge days are not added to Forecast History and do not advance the strict model state.

The existing current-week endpoint remains unchanged:

- `POST /api/forecast/current-week`

## Installation

1. Stop `run_server.bat` with `Ctrl + C`.
2. Back up the complete WATTZAN folder.
3. Extract `WATTZAN_v14_Forecast_UI_Update.zip`.
4. Copy the extracted `backend` and `frontend` folders into the current project root.
5. Choose **Replace the files in the destination**.
6. Do not delete or replace manually:
   - `backend/.env`
   - `backend/.venv`
   - `backend/artifacts/`
   - `backend/data/default/`
   - `backend/data/processed/wattzan.db`
7. Restart `backend/run_server.bat`.
8. Open `http://127.0.0.1:8000` and press `Ctrl + F5`.

## One-day current-date test

1. Open Forecast > Short-term Forecast.
2. Select Tacurong City using the map.
3. Keep the date at the current Philippine date.
4. Click **Fetch weather & run one-day forecast**.
5. WATTZAN should fetch the historical/current weather segments, recursively bridge the missing electricity dates, and save only the selected date.

The result is explicitly labeled `current_day_gap_bridge_scenario` because the missing electricity history consists of model predictions rather than observed loads.

## Other changes

- Current Philippine date is the default for both forecast modes.
- Weather calls retry once after a transient timeout or network failure.
- Seven-day result chart shows only the hybrid forecast.
- High and critical days are highlighted in orange and red.
- Chart colors are brighter and more saturated.
- WATTZAN branding is larger and simplified.
- Provider branding was removed from the assistant interface.
- Assistant answers use a fast typing effect and an animated three-dot loading indicator.
- Sidebar navigation has animated hover, active, and dropdown transitions.
- Overview 3D map has a grid floor, municipality pins, floating names, a low-angle close camera, and very slow automatic rotation.

## Verification

- Backend tests: 45 passed
- JavaScript syntax: passed
- Python compilation: passed
- Duplicate HTML IDs: none
- Long current-date one-day bridge test: passed through 2026-07-16
