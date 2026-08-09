# WATTZAN v15.5 Vercel edition

- Added official Vercel FastAPI entrypoint configuration.
- Added `public/` static frontend deployment.
- Added Postgres compatibility for persistent history and dataset metadata.
- Added database-backed CSV upload storage.
- Added console-only Vercel logging.
- Added temporary `/tmp` SQLite fallback when no Postgres integration exists.
- Added Vercel request-size-aware upload limit.
- Removed unused province-baseline artifacts from the deployment package.
- Preserved municipality forecasting calculations, model artifacts, frontend behavior, and chatbot workflow.

## v15.5.2 FastAPI entrypoint correction

- Removed the conflicting `functions.backend/server.py` block from `vercel.json`.
- Explicitly selected the `fastapi` framework preset.
- Retained the official custom entrypoint `backend.server:app` in `pyproject.toml`.
- Enabled Fluid compute at project configuration level.
