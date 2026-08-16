# WATTZAN v16.2.7 — Fast Short-Term Forecast Performance Update

## Purpose
Reduce one-day and seven-day current-date forecast waiting time without changing the trained pooled MLR, direct SARIMA, residual SARIMA, Hybrid weights, peak estimator, recommendation classifier, or planning datasets.

## Performance changes
- Replaced the old 90-day sequential Open-Meteo archive downloads with one explicit historical date-range request.
- Historical and recent/live weather segments are fetched concurrently, so a current-date bridge normally needs at most two simultaneous weather requests.
- Historical archive retrieval has a bounded fast-response budget. If the archive is slow/unavailable, only historical bridge days use the existing WATTZAN municipality monthly climatology; the target day/week still requires live Open-Meteo forecast data.
- Monthly planning rainfall is converted to a daily mean before it can be used as a bridge fallback.
- The backend now caches the parsed active municipality dataframe for each warm process and invalidates the cache when the active dataset changes.
- Recursive forecast loops reuse the resolved MLR feature order instead of rebuilding it on each step.
- Current-day/current-week client requests use a 50-second backend timeout instead of allowing multi-minute waits.

## Research integrity
The fast path does not retrain or alter production model artifacts. When climatology fallback is used, the request/response records `bridge_used_climatology_fallback=true` and identifies the bridge weather source. The forecast limitation text discloses this fallback.

## Deployment
Production remains pinned to Python 3.12 through `.python-version`. The one-click local launcher remains compatible with Python 3.14. No new deployment dependency was added.
