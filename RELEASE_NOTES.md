# WATTZAN Municipality Integration Release Notes

## Version

`2.0.0-municipality`

## Major change

The system no longer applies one province-wide model to every pinned location.
The selected municipality now determines the historical series, categorical
MLR input, direct SARIMA, residual SARIMA correction, hybrid weight, peak
estimate, recommendation inputs, summaries, and forecast-history filter.

## New backend behavior

- `municipality` is required for one-day and seven-day forecasts.
- Common aliases such as `Tacurong` normalize to `Tacurong City`.
- History and lag features are isolated by municipality.
- One-day forecasts must advance sequentially per municipality.
- Seven-day forecasts recursively use prior predicted municipal values.
- Twelve direct SARIMA and twelve residual SARIMA artifacts load at startup.
- The trained municipality peak estimator and recommendation classifier are used.
- `/api/data/municipalities` exposes selectable location profiles.
- `/api/data/summary?municipality=...` provides location-specific history.
- Forecast history can be filtered by municipality.
- Older SQLite databases receive municipality, latitude, and longitude columns.

## Frontend changes

- One-day and seven-day forecast forms require a municipality.
- The Leaflet pin synchronizes the municipality with the forecast forms.
- Long-term scenarios now start from the selected municipality's own synthetic
  annual history rather than allocating province totals by population share.
- Population share remains visible as planning context.
- Warnings clearly state municipal-level, synthetic-data, seven-day recursion,
  and long-term scenario limitations.

## Verification

- Python compilation passed.
- JavaScript syntax checking passed.
- 29 backend tests passed.
- Live FastAPI smoke calls succeeded for one-day and seven-day municipality forecasts.
- No original province model was deleted; it remains under
  `backend/artifacts/province_baseline` as a benchmark and fallback reference.

## Version 4: Open-Meteo automation and 3D Overview map

- Added a Short-Term Forecast Leaflet location selector with municipality markers, click-to-pin, draggable pin, and browser geolocation.
- Added automatic date-matched Open-Meteo weather retrieval for one-day and seven-day forms.
- Added one-click weather retrieval and forecast execution.
- Added automatic municipality population and holiday form completion.
- Replaced the flat Overview choropleth with a Three.js extruded municipality map supporting rotate, pan, zoom, hover, click, yearly updates, and camera reset.
- Added visible spacing between municipality meshes while retaining the blue consumption palette.
- Removed the yellow reminder banners from all pages.
- No backend, model, dataset, or database source file was changed.

## v5 – 3D map visibility and responsiveness

- Reduced municipality extrusion heights and changed the default camera angle.
- Increased contrast for low-consumption municipalities.
- Replaced continuous WebGL animation with event-driven rendering.
- Reduced WebGL pixel ratio and removed real-time shadow rendering.
- Added non-blocking Open-Meteo processing, request deduplication, and session caching.

## v2.1.0 — Current-week scenario bridge

- Added `GET /api/forecast/next-date`.
- Added `POST /api/forecast/current-week`.
- Preserved strict sequential validation for normal one-day and seven-day forecasts.
- Added automatic Open-Meteo chunking from the next model date through a user-selected current week.
- Added recursive in-memory gap bridging; only the requested final seven days are stored.
- Added explicit accumulated-error warnings for long scenario bridges.
- Added tests for clean-history and saved-one-day bridge states.
