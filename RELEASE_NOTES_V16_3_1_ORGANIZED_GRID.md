# WATTZAN v16.3.1 — Organized Tacurong Utility Grid

This release refines only the Tacurong Route Intelligence map renderer. Forecast models, route histories, route forecasts, weather fallbacks, deployment recovery, and production artifacts are unchanged.

## Map refinement
- Replaces the always-visible 367-segment extracted street overlay with a shared-route hierarchy derived from the packaged road-aligned route paths.
- Default city view shows only road corridors shared by at least three routes (about 184 segments in the current dataset).
- Zoom level 15 reveals corridors shared by at least two routes (about 284 segments).
- Zoom level 16+ reveals full local route detail (about 451 unique route-road edges).
- Individual route branches are no longer painted in 72 competing colors by default.
- Every route remains clickable through invisible hit paths.
- Selecting a route renders its full road-aligned path with the existing halo/highlight styling.
- Default map view is tightened to zoom 14 for a clearer Tacurong city focus.
- The Leaflet-free SVG fallback uses the same organized shared-route hierarchy instead of the former dense extracted overlay.
- The darkened OpenStreetMap basemap remains visible beneath the utility hierarchy.

## Research integrity
The map remains a planning visualization derived from route names and packaged road-aligned geometry. It is not official SUKELCO conductor GIS geometry or measured voltage classification.

## Regression coverage
- Default grid: 184 visible shared segments.
- Zoom 15: 284 visible segments.
- Zoom 16: 451 visible route-road edges.
- 72 routes remain selectable; selected Route 2519 renders a 23-point path in the regression scenario.
- No runtime Overpass road-network requests.
- All 10 primary pages remain navigable without browser errors.
- Seasonal route/long-term forecasts, one-day weather values, fast-weather bridge/fallback logic, and all production MLR/SARIMA artifacts remain passing.
