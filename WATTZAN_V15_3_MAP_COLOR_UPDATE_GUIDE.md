# WATTZAN v15.3 — 3D Map Color Gradient Update

## Change

The Overview 3D municipality map now uses a stronger consumption gradient:

**White → Light Blue → Vivid Blue → Indigo → Purple**

White is restricted to the minimum-consumption end of the scale. Most municipalities now display in blue tones, while the highest-consumption municipalities transition into purple.

## Files changed

- `frontend/app.js`
- `frontend/styles.css`

No backend, forecast, model, weather, database, or chatbot logic was changed.

## Installation

1. Stop WATTZAN with `Ctrl + C`.
2. Extract the v15.3 frontend update.
3. Copy the extracted `frontend` folder into the current WATTZAN project root.
4. Choose **Replace the files in the destination**.
5. Restart `backend/run_server.bat`.
6. Open `http://127.0.0.1:8000`.
7. Press `Ctrl + F5` to bypass the cached JavaScript and stylesheet.
