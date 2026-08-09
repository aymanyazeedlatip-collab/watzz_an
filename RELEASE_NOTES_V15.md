# WATTZAN v15 Release Notes

## Frontend-only refinement

Modified files:

- `frontend/index.html`
- `frontend/styles.css`
- `frontend/app.js`

Added documentation:

- `WATTZAN_V15_UPDATE_GUIDE.md`
- `RELEASE_NOTES_V15.md`

## Forecast protection

No backend forecast source file was changed. No trained artifact, dataset, SQLite schema, model formula, forecast endpoint, or weather endpoint was changed.

## Validation

- JavaScript syntax validation passed.
- HTML duplicate-ID validation passed.
- FastAPI startup passed.
- Backend automated tests: 45 passed.
- Backend hash comparison against v14 passed.
