# WATTZAN Open-Meteo Automation and 3D Overview Map Update

## Scope of this release

This release changes only the frontend. The FastAPI backend, SQLite logic, trained municipality artifacts, datasets, and model calculations are unchanged.

The update adds:

1. A location-selection map in Short-Term Forecast.
2. Browser geolocation, municipality markers, click-to-pin, and a draggable pin.
3. Automatic date-matched weather inputs from Open-Meteo.
4. One-button weather retrieval and forecast execution.
5. A controllable Three.js 3D municipality consumption map on Overview.
6. Removal of the yellow reminder banners from all pages.

## Important forecasting behavior

The backend requires forecasts to follow each municipality's available history sequentially. The bundled model history currently ends on December 31, 2024, so a municipality with no saved forecasts begins on January 1, 2025.

For that reason, the automatic weather tool chooses its source according to the requested model date:

- Past dates use Open-Meteo Historical Weather.
- Current and supported future dates use the Open-Meteo Forecast API.
- A seven-day range that crosses the present date is divided between the two services and merged.

Historical weather is archived/reanalysis weather, not a live observation. Forecast weather is date-matched forecast data. The interface identifies the selected source.

Available electrical capacity is not weather information. It remains optional and editable. Without capacity, WATTZAN may classify demand but does not claim a supply shortage.

## Short-Term Forecast workflow

1. Open Forecast > Short-Term Forecast.
2. Select One-day or Seven-day forecast.
3. Select a location using one of these methods:
   - Click inside the map.
   - Click a municipality marker.
   - Drag the blue pin.
   - Click Detect my location.
   - Select a municipality in either forecast form.
4. Confirm the selected municipality in the location summary.
5. Use Fetch weather inputs to fill the form without running the model.
6. Review or edit the generated values.
7. Use Fetch weather & run one-day forecast, or Fetch weather & run seven-day forecast, to retrieve the inputs and immediately execute the model.

The automation fills:

- Municipality
- Coordinates from the selected pin
- Population from the active municipality profile
- Mean, minimum, and maximum temperature
- Mean humidity
- Rainfall
- Mean heat index/apparent temperature
- Mean wind speed
- Mean cloud cover
- Holiday status and holiday name when recognized

## Three-dimensional Overview map controls

The Overview map uses local Sultan Kudarat municipality geometry and real annual totals returned by the active backend dataset.

Controls:

- Left-drag: rotate the camera
- Right-drag: pan the camera
- Mouse wheel: zoom
- Hover: show municipality and annual consumption
- Click: open the municipality information card
- Reset button: restore the camera and clear selection
- Year control: rebuild map colors and extrusion heights for 2020-2024

Municipalities use the existing blue choropleth palette. Their extrusion height represents annual electricity-consumption magnitude. A small geometry scale reduction creates visible gaps between neighboring municipal areas.

## Installation

1. Stop the WATTZAN server with Ctrl+C.
2. Rename the existing frontend folder to frontend_backup_before_open_meteo_3d.
3. Extract WATTZAN_OpenMeteo_3D_Map_Frontend_Update.zip.
4. Move the extracted frontend folder into the WATTZAN project root.
5. Confirm that backend and frontend are sibling folders.
6. Start backend/run_server.bat.
7. Open http://127.0.0.1:8000.
8. Press Ctrl+F5 to clear the old frontend cache.

## Internet requirements

The local WATTZAN API and trained models continue to run on the computer. An internet connection is required for:

- Open-Meteo weather requests
- OpenStreetMap map tiles used by the Short-Term Forecast selector
- Three.js and OrbitControls loaded through CDN
- Existing Chart.js and icon CDN resources

The 3D municipality geometry itself is stored locally.

## Verification checklist

- The Overview map is three-dimensional and contains 12 extruded locations.
- The camera rotates, pans, and zooms.
- Municipality clicks still open the existing information card.
- Changing the year changes both color and height.
- Short-Term Forecast shows the location-selection map.
- A clicked or dragged pin selects a municipality.
- Fetch weather inputs fills the appropriate form.
- Fetch weather & run completes a forecast and saves it to history.
- No yellow synthetic-data reminder banner appears on any tab.
- System Health still reports the municipality model bundle as production ready.
