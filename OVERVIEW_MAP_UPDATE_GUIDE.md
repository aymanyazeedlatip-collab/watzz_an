# WATTZAN Overview Consumption Map Update

## What changed

The Overview page now begins with a self-contained SVG choropleth map of Sultan Kudarat. It is not a Leaflet map and does not use map tiles.

The map:

- separates all 11 municipalities and Tacurong City;
- colors each location using its annual electricity-consumption magnitude;
- reads consumption values from the active backend dataset through `/api/data/summary`;
- supports 2020–2024 year selection;
- shows a hover tooltip;
- opens a detailed information card when clicked;
- supports keyboard selection with Tab and Enter/Space;
- can transfer the selected municipality to the Forecast page.

No backend source file was changed.

## Easiest installation method: use the complete updated project

1. Keep the WATTZAN server closed.
2. Rename your current working folder to `WATTZAN_BEFORE_OVERVIEW_MAP`.
3. Extract `WATTZAN_Municipality_Integrated_System_v2_Overview_Map.zip`.
4. Open the extracted `WATTZAN_MUNICIPALITY_INTEGRATED` folder.
5. Open its `backend` folder.
6. Double-click `run_server.bat`.
7. Wait for `Application startup complete`.
8. Open `http://127.0.0.1:8000`.
9. Press `Ctrl + F5` so the browser does not reuse the old frontend files.

## Smaller installation method: replace frontend only

1. Keep the server closed.
2. Rename the existing `frontend` folder to `frontend_backup_before_overview_map`.
3. Extract `WATTZAN_Overview_Consumption_Map_Frontend.zip`.
4. Move the extracted `frontend` folder into the main WATTZAN project root.
5. Confirm this structure:

```text
WATTZAN/
├── backend/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── assets/
│       ├── logo-placeholder.svg
│       ├── sultan-kudarat-municipalities.json
│       └── BOUNDARY_SOURCE_NOTICE.txt
└── ...
```

6. Open `backend` and run `run_server.bat`.
7. Open `http://127.0.0.1:8000`.
8. Press `Ctrl + F5`.

## How to use the map

1. Open the Overview tab.
2. Select a year from the map's Year control.
3. Darker blue means higher annual electricity consumption for that year.
4. Hover over a location to see its name and annual GWh.
5. Click a municipality or Tacurong City.
6. Review the popup card containing:
   - annual consumption;
   - province share;
   - daily average;
   - population;
   - customer connections;
   - supply system;
   - hybrid test MAPE;
   - consumption rank.
7. Click `Forecast this municipality` to open the Forecast page with that location selected.
8. Use the reset button to clear the selected municipality.

## Expected checks

- The map contains 12 clickable locations.
- The default year is the latest year available in the active dataset.
- Changing the year changes the fills and values.
- No Leaflet controls or map tiles appear in the Overview map.
- The existing Leaflet pin workflow remains only in the Long-Term Forecast page.
- When backend municipality data is unavailable, the map shows an empty-state message rather than invented values.

## Verification performed

- JavaScript syntax check: passed.
- Boundary JSON validation: passed.
- HTML duplicate-ID check: passed.
- Backend regression suite: 29 tests passed.
- Backend source comparison: unchanged from the original integrated release.
- Live FastAPI checks: health, map asset, municipality summary, municipality profiles, and model-performance endpoints loaded successfully.
