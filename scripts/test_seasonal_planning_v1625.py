from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'public/assets/wattzan-planning-data.json').read_text(encoding='utf-8'))

def check(label, cond):
    if not cond: raise AssertionError(label)
    print('[PASS]',label)

check('Current compact planning schema is present', int(data.get('schema_version',0))>=6)
season=data['municipality_monthly_consumption_seasonality']
check('Seasonality profiles exist for all 12 locations', len(season)==12)
for mun, raw in season.items():
    vals=[float(raw[str(i)]) for i in range(1,13)]
    check(f'{mun} monthly shares sum to 100%', abs(sum(vals)-1)<1e-6)
    check(f'{mun} seasonality is not flat', max(vals)/min(vals)>1.03)

routes=data['tacurong_routes_compact']
check('72 route forecasts preserved', len(routes)==72)
check('Every route forecast spans 2026-2034', all([int(r[0]) for r in route['forecast']]==list(range(2026,2035)) for route in routes))
tac=[float(season['Tacurong City'][str(i)]) for i in range(1,13)]
check('Tacurong seasonal profile has meaningful within-year movement', max(tac)/min(tac)>1.08)

fields=data['weather_fields']; periods=data['weather_periods']; weather=data['municipality_weather_monthly_compact']
check('Monthly weather exists for 12 locations', len(weather)==12)
check('Weather covers 2020-2034 monthly', periods[0]=='2020-01' and periods[-1]=='2034-12' and len(periods)==180)
for mun, series in weather.items():
    check(f'{mun} keeps all eight weather variables', len(series)==8)
    check(f'{mun} weather arrays align to monthly periods', all(len(values)==len(periods) for values in series))
    temp=series[fields.index('temperature_mean_c')]
    rain=series[fields.index('rainfall_mm')]
    i0=periods.index('2026-01'); future_temp=temp[i0:i0+12]; future_rain=rain[i0:i0+12]
    check(f'{mun} future temperature retains seasonal movement', max(future_temp)-min(future_temp)>0.25)
    check(f'{mun} future rainfall retains seasonal movement', max(future_rain)>min(future_rain))

check('Route methodology discloses seasonal reconstruction','seasonal reconstructions' in data['methodology']['route_forecast'])
check('Long-term seasonality methodology documented','long_term_seasonality' in data['methodology'])
print('\nWATTZAN seasonal planning checks passed for compact deployment schema.')
