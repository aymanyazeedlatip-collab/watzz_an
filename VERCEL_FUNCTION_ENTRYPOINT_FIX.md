# WATTZAN Vercel FastAPI Entrypoint Fix v15.5.2

## Error fixed

`The pattern "backend/server.py" defined in functions doesn't match any Serverless Functions inside the api directory.`

## Root cause

WATTZAN already declares its FastAPI application through the supported custom entrypoint:

```toml
[tool.vercel]
entrypoint = "backend.server:app"
```

The additional `functions.backend/server.py` configuration was being validated as a legacy file-based Serverless Function pattern, which expected a matching file under `api/` in this Vercel project configuration.

## Correct configuration

The `functions` block has been removed. Vercel now:

1. Uses the explicit FastAPI framework preset.
2. Reads `backend.server:app` from `pyproject.toml`.
3. Bundles project files using the Python runtime's default bundling behavior.
4. Serves the static frontend from `public/`.

The corrected `vercel.json` is:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "fastapi",
  "fluid": true
}
```

## GitHub installation

1. Replace the repository-root `vercel.json` with the corrected file.
2. Confirm `pyproject.toml` still contains:

```toml
[tool.vercel]
entrypoint = "backend.server:app"
```

3. Commit the change.
4. In Vercel, open **Settings → Build and Deployment** and set **Framework Preset** to **FastAPI** when it is not already selected.
5. Redeploy without using the previous build cache.
