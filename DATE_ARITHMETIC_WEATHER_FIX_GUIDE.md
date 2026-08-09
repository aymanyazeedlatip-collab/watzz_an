# WATTZAN Page-Unresponsive Weather Fix

## Confirmed root cause

The weather provider was not the cause of the browser freeze.

The frontend used local-time date arithmetic and then converted the result to an ISO UTC date:

```javascript
const date = new Date(`${isoDate}T00:00:00`);
date.setDate(date.getDate() + 1);
return date.toISOString().slice(0, 10);
```

In the Philippines (`UTC+08:00`), local midnight is still the previous calendar day in UTC. As a result:

```text
add one day to 2025-01-01 -> 2025-01-01
```

The Open-Meteo response was received, then this loop attempted to construct the requested date list:

```javascript
for (let current = startDate; current <= endDate; current = addDaysIso(current, 1))
```

Because `current` never advanced, JavaScript entered an infinite synchronous loop. Chrome then displayed **Page Unresponsive**.

## Correction

`frontend/app.js` now:

1. Parses date-only strings using `Date.UTC`.
2. Adds days using `setUTCDate` and `getUTCDate`.
3. Calculates inclusive day counts in UTC.
4. Builds weather date ranges with `Array.from` rather than an unbounded loop.
5. Rejects weather date ranges longer than 16 days.

Open-Meteo remains the active weather provider because its request was not the source of the freeze.

## Installation

1. Stop the FastAPI server.
2. Back up the current `frontend` folder.
3. Replace it with the `frontend` folder from the update package.
4. Restart `backend/run_server.bat`.
5. Open `http://127.0.0.1:8000`.
6. Press `Ctrl + F5`.

## Test

1. Open **Forecast > Short-Term Forecast**.
2. Select a municipality.
3. Click **Fetch weather inputs**.
4. Confirm the fields populate and the browser remains responsive.
5. Click **Fetch weather & run one-day forecast**.
6. Confirm the forecast completes.
7. Switch to seven-day mode and repeat.

## Verification performed

- JavaScript syntax check: passed.
- Asia/Manila `+1 day` regression: passed.
- Seven-day date generation: passed.
- Leap-day arithmetic: passed.
- Year-boundary arithmetic: passed.
- Backend automated tests: 29 passed.
- Backend and trained model files: unchanged.
