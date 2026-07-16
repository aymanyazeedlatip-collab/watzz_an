# WATTZAN Vercel dependency fix v15.5.4

## Confirmed error

Vercel imported `backend/server.py`, but failed with:

`ModuleNotFoundError: No module named 'fastapi'`

The root `pyproject.toml` declared the project and custom Vercel entrypoint but did not declare any `[project].dependencies`. Vercel therefore built the Python function without FastAPI and the rest of WATTZAN's runtime packages.

## Fix

Replace the repository-root `pyproject.toml` with the included file. It explicitly declares every production dependency and preserves:

`[tool.vercel] entrypoint = "backend.server:app"`

Commit the file and redeploy without build cache.
