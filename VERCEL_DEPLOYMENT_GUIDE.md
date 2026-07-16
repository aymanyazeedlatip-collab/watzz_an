# WATTZAN v15.5 — Vercel-only deployment guide

This package is specifically prepared for Vercel. Do not use the older v15.4 ZIP for Vercel.

## What changed for Vercel

- FastAPI is exported through `backend.server:app` using `pyproject.toml`.
- The browser application is duplicated under `public/` so Vercel serves HTML, CSS, JavaScript, and assets through its CDN.
- The runtime dependency list is available at repository-root `requirements.txt`.
- The FastAPI function is configured for a 300-second maximum duration.
- Only the municipality production artifacts are bundled. Obsolete province-baseline artifacts are excluded.
- Postgres is supported through `DATABASE_URL`, `POSTGRES_URL`, or `NEON_DATABASE_URL`.
- If no Postgres variable is available, WATTZAN temporarily falls back to `/tmp/wattzan/wattzan.db`. This is not persistent.
- Uploaded CSV contents are stored in the database rather than relying on permanent local files.
- File logging is disabled on Vercel; errors appear in Vercel Function Logs.
- Dataset uploads are capped at 4 MB on Vercel because of the platform request-size limit.

## Required Vercel environment variables

Add these before or immediately after the first deployment:

```text
VERCEL_SUPPORT_LARGE_FUNCTIONS=1
GEMINI_API_KEY=<your real working key>
GEMINI_MODEL=<the exact working model from your local backend/.env>
GEMINI_FALLBACK_MODELS=<your working fallback model, when used>
GEMINI_TIMEOUT_SECONDS=45
GEMINI_MAX_OUTPUT_TOKENS=4096
GEMINI_RETRY_OUTPUT_TOKENS=8192
GEMINI_THINKING_LEVEL=low
GEMINI_MAX_CONTEXT_CHARS=28000
APP_TIMEZONE=Asia/Manila
```

Do not upload `backend/.env` to GitHub.

## Persistent database

Use a Postgres database connected through the Vercel Marketplace. This package accepts the common injected names `DATABASE_URL`, `POSTGRES_URL`, and `NEON_DATABASE_URL`.

Without the database integration, the dashboard can start using temporary SQLite, but Forecast History and uploaded dataset records can disappear between function instances or deployments.

## GitHub upload

1. Extract this ZIP.
2. Open GitHub Desktop.
3. Choose **File → Add local repository**.
4. Select the extracted `WATTZAN_VERCEL_v15_5` folder.
5. When prompted, create a repository.
6. Commit with `Prepare WATTZAN for Vercel deployment`.
7. Publish the repository to GitHub. Keep it private unless the source code should be public.

## Vercel project creation

1. Sign in to Vercel.
2. Choose **Add New → Project**.
3. Import the GitHub repository.
4. Leave **Root Directory** blank.
5. Do not set an Output Directory.
6. Do not enter a custom Start Command.
7. Do not enter a Render-style Uvicorn command.
8. Add the environment variables listed above.
9. Deploy.

Vercel reads:

- `pyproject.toml` for `backend.server:app`
- `requirements.txt` for Python dependencies
- `vercel.json` for function duration and model/data files
- `public/` for the frontend

## Add persistent Postgres

1. Open the deployed Vercel project.
2. Open **Storage** or **Marketplace**.
3. Create or connect a Postgres provider, such as Neon.
4. Connect it to the WATTZAN project and Production environment.
5. Confirm that the integration created `DATABASE_URL`, `POSTGRES_URL`, or `NEON_DATABASE_URL`.
6. Redeploy the latest production deployment so the new variable is included.

## First tests

Open these paths using the Vercel domain:

```text
/
/api/health
/api/chatbot/status
```

Then test:

1. Overview and 3D map.
2. One-day current-date forecast.
3. Seven-day current-date forecast.
4. Forecast History after refreshing the page.
5. Assistant response.
6. Data Management using a CSV no larger than 4 MB.

## Build troubleshooting

### Function bundle is too large

Confirm that the Production environment has:

```text
VERCEL_SUPPORT_LARGE_FUNCTIONS=1
```

Then redeploy without build cache.

### `No module named app`

Confirm the repository contains:

```text
backend/__init__.py
backend/server.py
pyproject.toml
```

The Root Directory must remain blank.

### Website opens but API calls fail

Confirm `/api/health` works. Check **Vercel → Project → Logs → Functions** for the Python traceback.

### Assistant says setup required

Confirm the Gemini variables were applied to **Production**, then redeploy. Environment-variable edits do not change an already-built deployment.

### Forecast History disappears

The deployment is using temporary SQLite. Connect a Marketplace Postgres database, verify a supported database URL variable is present, and redeploy.

### First request is slow

A new Python function instance reconstructs the 24 municipality SARIMA model states during startup. Later calls to the warm instance are normally faster.

## Files that must remain in the repository

```text
backend/app/
backend/artifacts/municipality_v1/
backend/data/default/
backend/server.py
frontend/
public/
pyproject.toml
requirements.txt
vercel.json
```
