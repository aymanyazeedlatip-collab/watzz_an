# WATTZAN v9 Gemini Model Update

- Replaced the default `gemini-2.5-flash` configuration with `gemini-3.5-flash`.
- Added `gemini-3.1-flash-lite` as an automatic fallback.
- Added compatibility mapping for existing `.env` files that still contain `gemini-2.5-flash`.
- Added model-unavailable detection and retry behavior.
- The API key remains backend-only.
- No frontend, model artifact, forecast calculation, dataset, or SQLite schema was changed.
