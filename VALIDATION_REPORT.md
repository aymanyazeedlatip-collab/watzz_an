# WATTZAN v16 Validation Report

Validation completed after integrating the supplied original SUKELCO Tacurong annual anchors and retrained artifacts.

- Default daily dataset: 21,924 rows
- Municipality/city count: 12
- Date coverage: 2020-01-01 through 2024-12-31
- Duplicate municipality-date rows: 0
- Missing consumption values: 0
- Tacurong 2020 annual kWh anchor: exact match
- Tacurong 2021 annual kWh anchor: exact match
- Tacurong 2022 annual kWh anchor: exact match within floating-point precision
- Tacurong 2023 annual kWh anchor: exact match within floating-point precision
- Tacurong 2024 annual kWh anchor: exact match
- Production MLR artifact: loaded successfully
- Direct SARIMA artifacts: 12/12 reconstructed successfully
- Residual SARIMA artifacts: 12/12 reconstructed successfully
- Peak estimator: loaded successfully
- Recommendation classifier: loaded successfully
- Production history: loaded successfully through 2024-12-31
- Overall production model bundle: production_ready = true
- public/app.js: unchanged from deployed v15.5.4 baseline
- frontend/app.js: unchanged from deployed v15.5.4 baseline
- vercel.json: unchanged from working v15.5.4 deployment
- Modified Python files compile successfully
- Full/update/audit ZIP integrity: passed

A full FastAPI TestClient startup was not executed in this local tool environment because `sqlmodel` is not installed in the host interpreter. The Vercel package retains the working v15.5.4 `pyproject.toml` dependency list (only its version string changes), which includes `sqlmodel`; production model reconstruction was independently tested successfully.
