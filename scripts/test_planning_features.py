from __future__ import annotations
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ASSET=ROOT/'public/assets/wattzan-planning-data.json'

def check(label, condition):
    if not condition: raise AssertionError(label)
    print(f'[PASS] {label}')

def main():
    data=json.loads(ASSET.read_text(encoding='utf-8'))
    routes=data.get('tacurong_routes_compact', data.get('tacurong_routes', []))
    check('Planning asset loads', bool(data))
    check('All 2016-2026 overview years are present', all(str(y) in data['municipality_consumption_annual']['Tacurong City'] for y in range(2016,2027)))
    check('Twelve municipality consumption series are present', len(data['municipality_consumption_annual'])==12)
    check('2025-2026 map values are clearly planning forecasts', all(data['municipality_consumption_annual'][m][str(y)]['status']=='WATTZAN_TREND_FORECAST' for m in data['municipality_consumption_annual'] for y in (2025,2026)))
    check('Latest Tacurong route set has 72 routes', len(routes)==72)
    if data.get('tacurong_routes_compact'):
        check('Every current route reaches 2034', all(int(route['forecast'][-1][0])==2034 for route in routes))
        check('Every route carries consumer-month estimates', all(float(route['historical'][-1][3])>0 and float(route['forecast'][-1][3])>0 for route in routes))
    else:
        check('Every current route reaches 2034', all(any(int(row['year'])==2034 for row in route['forecast']) for route in routes))
        check('Every route carries consumer-month estimates', all(route['historical'][-1]['consumer_month_kwh']>0 and route['forecast'][-1]['consumer_month_kwh']>0 for route in routes))
    fields=data['weather_fields']; periods=data['weather_periods']; weather=data['municipality_weather_monthly_compact']
    check('All eight weather variables are packaged', len(fields)==8)
    check('Monthly weather exists for all 12 locations', len(weather)==12)
    check('Weather projections reach 2034', periods[-1]=='2034-12')
    check('Every weather field spans the full packaged period', all(len(series)==len(fields) and all(len(values)==len(periods) for values in series) for series in weather.values()))
    check('Twelve municipality-substituted MLR forms are present', len(data['mlr_substituted_models'])==12)
    check('Route map limitation is disclosed', 'no verified conductor gis geometry' in data['methodology']['route_map_geometry'].lower())
    print('\nWATTZAN planning-feature data checks passed.')
if __name__=='__main__': main()
