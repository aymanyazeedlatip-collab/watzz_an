"""Performance sanity check for the production MLR/SARIMA artifacts without database imports."""
from pathlib import Path
import json, math, time
from datetime import timedelta
import joblib
import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX

ROOT=Path(__file__).resolve().parents[1]
BACKEND=ROOT/'backend'
PROD=BACKEND/'artifacts/municipality_v1/production'
FEATURE=BACKEND/'artifacts/municipality_v1/feature_config'
MUNICIPALITY='Tacurong City'
STEPS=600

mlr=joblib.load(PROD/'municipality_mlr_production.joblib')
history=pd.read_csv(PROD/'municipality_production_history.csv',parse_dates=['date'])
data=pd.read_csv(BACKEND/'data/default/wattzan_municipality_model_dataset.csv',parse_dates=['date'])
loc=data[data.municipality==MUNICIPALITY].sort_values('date')
last=loc.iloc[-1].to_dict()
feature_names=list(mlr.feature_names_in_)
# Build one valid representative row; repeated single-row pipeline inference is the
# expensive operation in the recursive bridge, so this is a conservative microbenchmark.
d=last['date']
last['month_category']=str(d.month)
last['doy_sin']=math.sin(2*math.pi*d.dayofyear/365.25)
last['doy_cos']=math.cos(2*math.pi*d.dayofyear/365.25)
X=pd.DataFrame([{name:last[name] for name in feature_names}],columns=feature_names)
mlr.predict(X)
t0=time.perf_counter()
for _ in range(STEPS):
    mlr.predict(X)
mlr_seconds=time.perf_counter()-t0

sarima_seconds=0.0
for kind in ('direct','residual'):
    artifact=json.loads((PROD/f'tacurong_city_{kind}_sarima_production.json').read_text())
    h=history[history.municipality==MUNICIPALITY].sort_values('date')
    values=(np.log(h.consumption_kwh.astype(float).values)
            if artifact['series_type']=='direct_consumption'
            else h.production_mlr_residual_kwh.astype(float).values)
    series=pd.Series(values,index=pd.DatetimeIndex(h.date,freq='D'))
    model=SARIMAX(series,order=tuple(artifact['order']),seasonal_order=tuple(artifact['seasonal_order']),enforce_stationarity=False,enforce_invertibility=False)
    result=model.filter(np.asarray(artifact['parameters'],dtype=float))
    t=time.perf_counter(); result.forecast(steps=STEPS); sarima_seconds += time.perf_counter()-t

total=mlr_seconds+sarima_seconds
assert total < 15, f'Production inference benchmark exceeded 15 seconds: {total:.3f}s'
print(json.dumps({'steps':STEPS,'mlr_seconds':round(mlr_seconds,3),'sarima_forecast_seconds':round(sarima_seconds,3),'core_inference_seconds':round(total,3),'threshold_seconds':15},indent=2))
