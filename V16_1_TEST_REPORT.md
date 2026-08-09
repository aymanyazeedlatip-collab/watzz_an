# WATTZAN v16.1 Verification Report

## Automated backend regression

- Existing integration/unit suite: **45 passed**
- Production model bundle: PASS
- Direct municipality SARIMA models loaded: **12/12**
- Residual municipality SARIMA models loaded: **12/12**
- Production-ready model bundle: **true**

## API smoke test

All returned HTTP 200 against a clean SQLite smoke-test database:

- `/api/health`
- `/api/deployment-diagnostics`
- `/api/models/status`
- `/api/models/performance`
- `/api/data/active`
- `/api/data/municipalities`
- `/api/data/summary`
- `/api/forecast/history`
- `/api/chatbot/status`
- `/api/forecast/next-date?municipality=Tacurong%20City`

`/api/deployment-diagnostics` reported `status=ready`, `models_loaded=true`, and
an empty `startup_errors` list.

## Frontend/static validation

- `public/app.js`: JavaScript syntax PASS
- `frontend/app.js`: JavaScript syntax PASS
- `public/dependency-loader.js`: JavaScript syntax PASS
- `frontend/dependency-loader.js`: JavaScript syntax PASS
- Duplicate HTML IDs: **0**
- Direct third-party `<script>` and `<link>` dependency tags in HTML: **0**
- `public` and `frontend` application mirrors: PASS
- `vercel.json`: valid JSON
- Python backend compilation: PASS

## Integrity comparison against v16

Unchanged:

- `backend/app/api/forecast.py`
- `backend/app/services/forecast_service.py`
- `backend/app/services/feature_builder.py`
- `backend/app/services/recommendation_service.py`
- `backend/app/api/chatbot.py`
- `backend/app/services/chatbot_service.py`
- `backend/app/services/model_loader.py`
- `backend/app/services/preprocessing_service.py`
- Entire `backend/artifacts/` tree: exact byte match
- Entire `backend/data/default/` tree: exact byte match

## Environment limitation

The container cannot make ordinary browser/CDN network requests to the public
internet, so the final Vercel external-proxy hop could not be exercised from
this environment. Vercel supports external-origin rewrites, and the package
uses that supported mechanism. The deployed site should be checked after the
new Git commit reaches Production.
