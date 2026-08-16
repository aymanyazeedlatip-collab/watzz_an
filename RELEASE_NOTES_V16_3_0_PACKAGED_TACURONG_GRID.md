# WATTZAN v16.3.0 — Packaged Tacurong Grid Final Fix

This release removes the last runtime dependency that could leave the Tacurong Route Intelligence map blank after deployment.

## Root cause fixed
v16.2.9 still requested Tacurong road geometry from public Overpass servers in the browser. Leaflet/OpenStreetMap tiles could load while those road-data requests failed, leaving only the darkened Tacurong basemap and a `Street grid unavailable — retry` message.

## Final architecture
- The road-aligned Tacurong planning grid is now packaged directly with WATTZAN.
- The application no longer calls Overpass at runtime for the grid.
- 72 route paths and 367 road-aligned grid corridors are included in the packaged network.
- The packaged geometry was calibrated against the Tacurong OpenStreetMap basemap used by the deployed interface so the overlay follows the visible road/highway directions instead of a radial hub-and-spoke pattern.
- The normal Leaflet/OpenStreetMap basemap remains darkened but visible underneath the electricity network.
- A native SVG fallback now uses the same packaged dense network if Leaflet itself is unavailable; the old sparse route-spoke fallback is not used.
- Route selection, Route Forecast, seasonal route forecasts, weather fallbacks, MLR/SARIMA/Hybrid artifacts, and Vercel configuration are unchanged.

## Scientific disclosure
The grid remains a planning visualization. The supplied SUKELCO route ledgers do not contain official conductor GIS polylines or voltage classifications, so WATTZAN does not claim the displayed line geometry as measured SUKELCO infrastructure.

## Deployment regression tests
- 72/72 route paths packaged and valid.
- 367 road-aligned utility-grid corridors packaged.
- Primary, feeder, distribution, and local hierarchy all represented.
- Zero browser Overpass/road-geometry requests required.
- Dense grid renders with all external road-data sources blocked.
- Route 2519 selection/highlighting verified.
- Native no-Leaflet fallback renders the packaged dense grid.
- One-day weather visualization and total Open-Meteo outage fallback retained.
- Seasonal route/long-term planning retained.
- Pooled MLR, 12 direct SARIMA, 12 residual SARIMA, Hybrid, peak, recommendation, and production-history artifacts remain production-ready.
