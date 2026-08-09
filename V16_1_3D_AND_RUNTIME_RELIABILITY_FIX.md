# WATTZAN v16.1 — 3D Map and Runtime Reliability Fix

## Confirmed root cause

The deployed v16 HTML loaded Three.js, OrbitControls, Chart.js, Leaflet, Lucide,
and Chart Zoom directly from third-party CDN domains. If the browser/network
failed to reach one of those domains, `window.THREE` or
`window.THREE.OrbitControls` was missing and the Overview 3D map displayed the
library/WebGL error even while WATTZAN and its API were online.

A second dependency defect was also found: chartjs-plugin-zoom was loaded
without its Hammer.js browser dependency.

## Corrections

1. All browser libraries now load first through same-origin `/vendor/*` paths.
2. Vercel proxies those paths to pinned external package versions.
3. Each JavaScript dependency has a direct-CDN fallback in the browser loader.
4. Hammer.js is loaded before Chart Zoom.
5. The application starts even when an optional visual dependency fails.
6. Three.js and OrbitControls failures are reported separately from WebGL
   hardware/browser failures.
7. WebGL renderer construction is protected with `try/catch` so one graphics
   initialization problem cannot crash the rest of the dashboard.
8. Dynamic app loading is safe whether it finishes before or after
   `DOMContentLoaded`.
9. Health metadata now reports release `16.1.0-runtime-reliability`.

## Forecast/model integrity

No forecast endpoint, forecasting formula, feature builder, retrained model
artifact, retrained default dataset, recommendation service, or chatbot service
was changed.

## Deployment

Copy the update files into the existing GitHub repository, commit and push.
Vercel will redeploy automatically. No environment variables need to be changed.
After the deployment becomes Ready, use Ctrl+F5 once to clear the old HTML/JS
from the browser cache.
