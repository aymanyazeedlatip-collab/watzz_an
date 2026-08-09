# WATTZAN 3D Map Visibility and Open-Meteo Responsiveness Update

This update changes only `frontend/`. The FastAPI backend, SQLite database, municipality datasets, and trained model artifacts are unchanged.

## What changed

### 3D Overview map

- Reduced municipality extrusion height by roughly 60 percent.
- Changed the initial camera to a clearer, more top-down angle.
- Strengthened the light-blue end of the consumption scale so low-consumption municipalities no longer blend into the background.
- Darkened the map floor and municipality outlines slightly for better separation.
- Reduced the desktop map container height from 590 px to 520 px.
- Kept rotation, pan, zoom, click, year switching, popup details, and municipal gaps.

### Browser responsiveness

The old 3D map rendered continuously, including while the user was on another tab. This could consume substantial GPU resources and make Chrome display a Page Unresponsive warning while Open-Meteo was loading.

The new map renders only when one of these events occurs:

- Camera movement
- Window resizing
- Map-year change
- Municipality selection
- Popup reset

Additional changes:

- WebGL pixel ratio is capped at 1.25.
- Real-time shadows are disabled.
- The weather request yields control back to the browser before parsing and filling inputs.
- Historical and forecast segments are requested in parallel when both are needed.
- Recently fetched weather responses are cached for repeat requests.
- Duplicate weather-button clicks are blocked while a request is active.

## Installation

1. Stop WATTZAN using `Ctrl + C` in its server window.
2. Rename the current `frontend` folder to `frontend_backup_before_responsiveness_fix`.
3. Extract the frontend update ZIP.
4. Move the extracted `frontend` folder into the WATTZAN project root.
5. Restart `backend/run_server.bat`.
6. Open `http://127.0.0.1:8000`.
7. Press `Ctrl + F5`.

## First test

1. Open Overview.
2. Confirm that all 12 municipal areas are visibly blue, including the lowest-consumption areas.
3. Rotate, pan, and zoom the map.
4. Open Short-term Forecast.
5. Select a municipality and click `Fetch weather inputs`.
6. Confirm that the page remains responsive and displays progressive status messages.
7. Repeat the same request. The second request should usually return faster because it is cached in the current browser session.

## Notes

An internet connection is still required for Open-Meteo, Leaflet map tiles, Three.js, Chart.js, and Lucide icons. The production model inference continues to run through the local FastAPI backend.
