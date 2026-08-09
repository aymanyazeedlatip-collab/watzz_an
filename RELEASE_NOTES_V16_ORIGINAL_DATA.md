# WATTZAN v16 — Original Data Retrained Release

This release is based directly on the working Vercel v15.5.4 deployment.

Changes:
- New supplied WATTZAN logo used for favicon, sidebar branding, and About page.
- Tacurong City 2020–2024 annual electricity consumption is hard-anchored to the supplied original SUKELCO HISTORY ledgers.
- Tacurong customer-count scale is recalibrated using the annual ledger consumer totals.
- Existing daily features/lags are recomputed after calibration.
- The same MLR, direct SARIMA, residual SARIMA/Hybrid, peak, and recommendation training architecture was rerun.
- Production model artifacts and website Model Performance data are replaced by the retrained outputs.
- Hybrid now leads MLR/SARIMA on R², RMSE, MAE, and MAPE in the 2024 held-out evaluation.

No forecast workflow, route signature, JavaScript application logic, Vercel entrypoint, weather-fetch workflow, or chatbot request flow was redesigned.
