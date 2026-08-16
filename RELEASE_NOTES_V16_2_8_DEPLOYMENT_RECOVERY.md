# WATTZAN v16.2.8 — Vercel Deployment Recovery

## Root cause fixed
The deployed repository was missing `wattzan-planning-data.json`, even though the v16.2.7 frontend required it. This caused blank long-term weather charts, prevented Tacurong Route Intelligence from initializing, and disabled the historical-weather fallback used when Open-Meteo timed out.

## Reliability changes
- Added a compact canonical planning-data asset for both `public/` and `frontend/`.
- Open-Meteo archive **and live forecast** failures now fall back to packaged WATTZAN seasonal climatology, clearly labeled as a fallback.
- Weather-only requests also use the packaged fallback instead of terminating with a timeout error.
- Added native SVG chart rendering if Chart.js cannot be loaded.
- Added a built-in Tacurong utility-grid SVG fallback if Leaflet cannot be loaded.
- Reduced frontend dependency-loader waits and bumped cache keys to 16.2.8.
- Production MLR, SARIMA, Hybrid, peak, and recommendation artifacts were not changed.
