# WATTZAN v15 Interface Refinement Guide

## Scope of this update

This release changes the frontend interface only. It does not modify the FastAPI forecast endpoints, MLR model, municipality SARIMA models, hybrid calculation, peak-demand model, recommendation rules, Open-Meteo workflow, database schema, or trained artifacts.

## New interface features

- Smaller floating municipality labels on the Overview 3D map.
- A global animated loading bar for one-day, seven-day, automated weather-and-forecast, and long-term projection workflows.
- More zoomed-out initial views on both Leaflet maps.
- An Operational Stability Score from 0 to 100 in Overview and Recommendations.
- A color-changing donut visualization with the score shown in its center.
- Smooth opening and closing animation for navigation submenus.
- Smooth opening animation for the floating Assistant window.
- Redesigned About page with animated project graphics, statistics, workflow cards, and research-integrity information.
- Subtle background orbit animations at 25% opacity, equivalent to 75% transparency.
- Removal of the Active Dataset status card from the top bar.

## Operational Stability Score

The stability score is a frontend decision-support indicator. It does not change or retrain any forecast model.

It combines information already returned by WATTZAN:

1. Recent demand classifications.
2. Capacity utilization when capacity values are available.
3. Variation in the most recent forecast values for the same municipality.

The score uses these display bands:

- 82–100: Stable
- 66–81: Generally stable
- 48–65: Watch conditions
- 30–47: High strain
- 0–29: Critical instability

When capacity is unavailable, the score is calculated from demand classification and forecast variation, and the interface states that capacity was not provided. The score is intended as a dashboard summary, not an additional machine-learning prediction.

## Update installation

1. Stop WATTZAN by pressing `Ctrl + C` in the FastAPI terminal.
2. Back up the complete current WATTZAN folder.
3. Extract `WATTZAN_v15_Interface_Refinement_Update.zip`.
4. Copy the extracted `frontend` folder into the existing WATTZAN project root.
5. Select **Replace the files in the destination** when Windows asks.
6. Do not delete `backend/.env`, `backend/.venv`, `backend/artifacts`, `backend/data/default`, or `backend/data/processed/wattzan.db`.
7. Restart `backend/run_server.bat`.
8. Open `http://127.0.0.1:8000`.
9. Press `Ctrl + F5` to bypass the cached CSS and JavaScript.

## Testing checklist

- Open Overview and confirm that municipality labels are smaller.
- Confirm that the map still rotates slowly and every pin remains visible.
- Open Short-term Forecast and confirm the initial map shows a wider provincial area.
- Run a one-day forecast and confirm the loading bar appears beneath the top bar.
- Run a seven-day forecast and confirm the same loading bar appears.
- Open Recommendations and confirm the Stability Score is the first highlighted card.
- Confirm the donut number and color change with the current score.
- Expand and close the Forecast or System Information navigation groups.
- Open the floating Assistant and confirm the pop-up animates smoothly.
- Open About and confirm the new animated hero, statistics, workflow, and ownership panels.
- Confirm that the top bar no longer contains the Active Dataset card.
