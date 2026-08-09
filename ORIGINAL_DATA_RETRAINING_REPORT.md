# WATTZAN v16 — Original Data Retraining and Deployment Update

## What changed

This release keeps the v15.5.4 Vercel application behavior and forecasting workflows, but replaces the visual logo and retrains the existing municipality-aware model architecture using the newly supplied original SUKELCO Tacurong City ledgers as calibration anchors.

## Original data audit

The supplied HISTORY files contain SUKELCO Tacurong City annual route-ledger totals for 2016–2025. The files are annual aggregates, not daily meter records, and they do not contain daily weather observations. The separate CONSUMER LEDGER archive has different/inconsistent annual coverage and is therefore retained as provenance/reference instead of being naively treated as a complete daily training source.

To preserve WATTZAN's existing daily MLR/SARIMA/Hybrid functions without inventing observed daily measurements, the retraining dataset uses the original SUKELCO HISTORY annual kWh totals as hard Tacurong City anchors for 2020–2024. The prior within-year daily profile is proportionally rescaled so that each Tacurong annual sum matches the supplied original total exactly. Annual consumer-entry totals are converted to an average-month anchor and used to recalibrate Tacurong customer counts. All lag/rolling variables are recomputed afterward.

The other 11 municipality daily histories and daily weather variables remain modeled research data because no equivalent original daily source was supplied for them. The 2016–2019 and 2025/2026 ledger values are stored as reference/provenance and are not fabricated into daily observations.

## Exact Tacurong annual kWh anchors used for retraining

- 2020: 41,391,642.00 kWh
- 2021: 42,646,115.83 kWh
- 2022: 43,098,777.90 kWh
- 2023: 46,261,133.62 kWh
- 2024: 53,550,492.00 kWh

## Retraining procedure

The same model-development functions and architecture were used:

- Pooled municipality-aware Multiple Linear Regression
- Municipality-specific direct SARIMA
- Municipality-specific residual SARIMA correction
- Hybrid MLR–SARIMA forecast
- Peak-demand estimator
- Recommendation classifier

Training period: 2020–2022. Validation period: 2023. Held-out rolling one-day-ahead test period: 2024.

## New 2024 held-out model results

| Model | R² | RMSE (kWh) | MAE (kWh) | MAPE |
|---|---:|---:|---:|---:|
| MLR | 0.990193 | 4,090.13 | 2,363.75 | 3.7972% |
| SARIMA | 0.989384 | 4,255.42 | 2,506.44 | 3.5800% |
| Hybrid MLR–SARIMA | **0.991722** | **3,757.69** | **2,126.61** | **3.3572%** |

The retrained Hybrid model is the best of the three on R², RMSE, MAE, and MAPE.

## Website integration

- Replaced the sidebar/favicon/About-page logo with the supplied WATTZAN image.
- Replaced production model artifacts with the retrained artifacts.
- Replaced Model Performance tables with the new 2024 evaluation outputs.
- Replaced the built-in default dataset with the original-anchored retraining dataset.
- Updated only explanatory/result strings so the website no longer describes the entire dataset as purely synthetic.
- No forecast route names, request schemas, forecast algorithms, navigation functions, weather-fetch functions, chatbot request functions, or user workflow functions were redesigned.

## Deployment

Merge this update into the GitHub repository currently connected to Vercel, commit, and push. Vercel will redeploy automatically. Keep all existing Vercel environment variables, especially the Gemini variables and any database variables.
