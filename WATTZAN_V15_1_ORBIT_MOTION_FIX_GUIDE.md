# WATTZAN v15.1 — Ambient Orbit Motion Fix

## Problem
The background circles were visible but appeared stationary. The old effect only rotated perfect circular outlines, which look unchanged while rotating. The small orbit nodes also moved too slowly and subtly to make the movement obvious.

## Fix
Only `frontend/styles.css` changed.

- Added visible drifting motion across the background.
- Added colored arc segments so rotation can be seen.
- Added a subtle pulse to the orbit nodes.
- Kept the complete effect at 25% opacity, equivalent to 75% transparency.
- Left all forecasting, weather, chatbot, backend, models, and database code unchanged.

## Installation
1. Stop WATTZAN with `Ctrl + C`.
2. Extract `WATTZAN_v15_1_Orbit_Motion_Fix_Update.zip`.
3. Copy the extracted `frontend` folder into the current WATTZAN project root.
4. Choose **Replace the files in the destination**.
5. Restart `backend/run_server.bat`.
6. Open `http://127.0.0.1:8000`.
7. Press `Ctrl + F5` to bypass the cached stylesheet.

## Expected behavior
The three background orbit rings should slowly rotate and drift along different paths. Their colored nodes should pulse gently. The movement remains decorative and does not block clicks.

## Reduced-motion setting
WATTZAN respects the operating system or browser **Reduce motion** accessibility preference. When that preference is enabled, decorative animations are intentionally stopped. On Windows, check **Settings → Accessibility → Visual effects → Animation effects** if the circles remain stationary after a hard refresh.
