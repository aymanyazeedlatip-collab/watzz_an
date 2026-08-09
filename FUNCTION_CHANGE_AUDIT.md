# v16 Source/Function Change Audit

Changed files relative to the working v15.5.4 Vercel baseline:

- `pyproject.toml`
- `public/styles.css`
- `public/index.html`
- `frontend/styles.css`
- `frontend/index.html`
- `backend/artifacts/municipality_v1/metrics/macro_average_municipality_metrics_2024.csv`
- `backend/artifacts/municipality_v1/metrics/overall_forecasting_metrics_2024.csv`
- `backend/artifacts/municipality_v1/metrics/forecast_significance_tests.csv`
- `backend/artifacts/municipality_v1/metrics/municipality_test_predictions_2024.csv`
- `backend/artifacts/municipality_v1/metrics/municipality_forecasting_metrics_2024.csv`
- `backend/artifacts/municipality_v1/metrics/province_aggregate_predictions_2024.csv`
- `backend/artifacts/municipality_v1/metrics/monthly_forecasting_metrics_2024.csv`
- `backend/artifacts/municipality_v1/metrics/peak_demand_metrics_2024.csv`
- `backend/artifacts/municipality_v1/metrics/recommendation_evaluation.json`
- `backend/artifacts/municipality_v1/metrics/province_aggregate_consistency_metrics_2024.csv`
- `backend/artifacts/municipality_v1/metrics/sarima_and_hybrid_tuning.csv`
- `backend/artifacts/municipality_v1/metrics/training_report.json`
- `backend/artifacts/municipality_v1/metrics/municipality_mlr_coefficients.csv`
- `backend/artifacts/municipality_v1/feature_config/selected_sarima_configurations.json`
- `backend/artifacts/municipality_v1/production/bagumbayan_residual_sarima_production.json`
- `backend/artifacts/municipality_v1/production/president_quirino_residual_sarima_production.json`
- `backend/artifacts/municipality_v1/production/palimbang_residual_sarima_production.json`
- `backend/artifacts/municipality_v1/production/municipality_mlr_evaluation.joblib`
- `backend/artifacts/municipality_v1/production/kalamansig_residual_sarima_production.json`
- `backend/artifacts/municipality_v1/production/lutayan_residual_sarima_production.json`
- `backend/artifacts/municipality_v1/production/municipality_recommendation_classifier.joblib`
- `backend/artifacts/municipality_v1/production/isulan_residual_sarima_production.json`
- `backend/artifacts/municipality_v1/production/senator_ninoy_aquino_residual_sarima_production.json`
- `backend/artifacts/municipality_v1/production/esperanza_residual_sarima_production.json`
- `backend/artifacts/municipality_v1/production/municipality_peak_estimator.joblib`
- `backend/artifacts/municipality_v1/production/tacurong_city_residual_sarima_production.json`
- `backend/artifacts/municipality_v1/production/lambayong_residual_sarima_production.json`
- `backend/artifacts/municipality_v1/production/municipality_production_history.csv`
- `backend/artifacts/municipality_v1/production/municipality_mlr_production.joblib`
- `backend/artifacts/municipality_v1/production/lebak_residual_sarima_production.json`
- `backend/artifacts/municipality_v1/production/tacurong_city_direct_sarima_production.json`
- `backend/artifacts/municipality_v1/production/columbio_residual_sarima_production.json`
- `backend/data/default/wattzan_municipality_model_dataset.csv`
- `backend/app/api/models.py`
- `backend/app/services/forecast_service.py`
- `backend/app/services/chatbot_service.py`
- `backend/app/services/preprocessing_service.py`

New files:

- `MODEL_METRICS_OLD_VS_NEW.csv`
- `ORIGINAL_DATA_RETRAINING_REPORT.md`
- `backend/data/original_source_summary/original_sukelco_tacurong_history_annual_totals.csv`
- `backend/data/original_source_summary/ORIGINAL_DATA_PROVENANCE.json`
- `backend/data/original_source_summary/tacurong_anchor_validation.csv`
- `backend/data/original_source_summary/tacurong_calibration_audit_2020_2024.csv`
- `backend/data/original_source_summary/original_sukelco_tacurong_consumer_ledger_annual_totals.csv`
- `frontend/assets/wattzan-logo.jpg`
- `public/assets/wattzan-logo.jpg`

## Functional-code policy

JavaScript application logic (`public/app.js` and `frontend/app.js`) is byte-for-byte unchanged. Vercel routing/entrypoint behavior is unchanged. Forecast route signatures and model formulas were not redesigned. Python source edits are limited to data-provenance/result-description strings; the trained artifact weights themselves are replaced by the retraining outputs.
