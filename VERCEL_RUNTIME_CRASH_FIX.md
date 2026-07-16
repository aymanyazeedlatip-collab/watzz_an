# WATTZAN v15.5.3 — Vercel runtime-crash hardening

This update addresses the generic Vercel `FUNCTION_INVOCATION_FAILED` page.

## Changes

- Routes `/` directly to the static `public/index.html` file, so opening the dashboard does not cold-start the scientific Python backend merely to serve HTML.
- Limits OpenBLAS, OpenMP, MKL, NumExpr, BLIS, and Accelerate to one worker thread before NumPy/SciPy imports.
- Prevents an ordinary model-loading exception from terminating the whole FastAPI process.
- Adds `/api/deployment-diagnostics` with safe startup details.
- Adds a fallback diagnostic FastAPI app when importing the main application fails.

No forecast formulas, frontend behavior, model artifacts, or trained values were changed.

## After redeployment

Open these URLs in order:

1. `https://YOUR-PROJECT.vercel.app/`
2. `https://YOUR-PROJECT.vercel.app/api/health`
3. `https://YOUR-PROJECT.vercel.app/api/deployment-diagnostics`

If diagnostics report `startup_import_failed`, copy the JSON response. If they report `degraded`, copy `startup_errors` and any model component whose `loaded` value is false.
