# WATTZAN v16.2.9 — Dense Tacurong Street-Grid Restore

This hotfix restores the dense shared road-following Tacurong electricity-grid visualization while preserving the v16.2.8 deployment-recovery protections.

## Root cause
The v16.2.8 recovery build could fall back to a sparse predefined corridor/branch drawing whenever live OSM road geometry did not resolve. That fallback visually resembled the older hub-and-spoke route map and could replace the intended dense utility-grid appearance even though Leaflet and the basemap were working.

## Changes
- Leaflet mode no longer renders the sparse corridor fallback.
- While road geometry is loading, the darkened OpenStreetMap basemap stays visible with a loading status.
- The dense shared utility mesh is rendered only after real OSM road geometry is resolved.
- Overpass requests now use POST form requests and the current public endpoints `overpass-api.de` and `overpass.private.coffee`.
- A new cache key prevents reuse of older route-network geometry.
- If both OSM road sources fail, WATTZAN shows a clear Retry grid action rather than silently reverting to the rejected sparse map.
- Selected-route forecasting, seasonal planning, weather fallbacks, Chart/Leaflet recovery logic, production MLR/SARIMA artifacts, and Vercel deployment configuration are unchanged.

## Regression coverage
- Secondary Overpass source successfully builds a 463-segment shared grid when the primary source fails.
- Complete road-source failure renders zero sparse fallback grid/route branches and exposes Retry grid.
- Existing route workflow, 2016–2026 overview, seasonal forecasts, weather fallbacks, and trained model artifact checks remain passing.
