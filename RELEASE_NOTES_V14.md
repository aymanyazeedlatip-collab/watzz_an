# WATTZAN v14 Release Notes

Version: `2.6.0-forecast-ui-enhancements`

## Fixed

- Current-date one-day forecasts no longer fail strict sequential validation.
- Added a current-day recursive gap-bridge endpoint.
- Added retry behavior for transient external weather fetch failures.

## Interface

- Simplified and enlarged WATTZAN sidebar branding.
- Removed the top operations eyebrow.
- Removed assistant-provider naming from the user interface.
- Added chatbot typing and loading animations.
- Added navigation transitions.
- Added 3D map grid floor, municipality pins, floating labels, automatic camera rotation, and a lower default camera angle.
- Increased chart brightness and saturation.
- Simplified the seven-day chart to hybrid consumption only, with high-demand highlighting.
- Forecast forms default to the current Philippine date.

## Unchanged

- Trained MLR, SARIMA, hybrid, peak-demand, and recommendation artifacts.
- Municipality dataset.
- Gemini/API key values in the user's `.env`.
- Existing SQLite forecast history when the update package is merged correctly.
