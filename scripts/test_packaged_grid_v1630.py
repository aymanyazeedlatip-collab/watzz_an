from pathlib import Path
import json, math, re
ROOT=Path(__file__).resolve().parents[1]
for side in ('public','frontend'):
    p=ROOT/side/'assets'/'tacurong-street-network.json'
    data=json.loads(p.read_text(encoding='utf-8'))
    assert data['schema_version']==2
    assert data['routeCount']==72
    assert len(data['paths'])==72
    assert len(data['gridSegments'])>=300
    for route,path in data['paths'].items():
        assert len(path)>=2, route
        for lat,lng in path:
            assert 6.60 < float(lat) < 6.78 and 124.58 < float(lng) < 124.78, (route,lat,lng)
    tiers={s['tier'] for s in data['gridSegments']}
    assert tiers=={'primary','feeder','distribution','local'}, tiers
    for seg in data['gridSegments']:
        assert len(seg['path'])==2
        for lat,lng in seg['path']:
            assert math.isfinite(float(lat)) and math.isfinite(float(lng))
app=(ROOT/'public'/'app.js').read_text(encoding='utf-8')
assert 'TACURONG_PACKAGED_STREET_NETWORK' in app
assert 'overpass-api.de' not in app.lower()
assert 'overpass.private.coffee' not in app.lower()
assert 'fetchTacurongRoadPayload' not in app
assert 'Packaged road-aligned utility grid loaded' in app
assert (ROOT/'public'/'app.js').read_bytes()==(ROOT/'frontend'/'app.js').read_bytes()
assert (ROOT/'public'/'assets'/'tacurong-street-network.json').read_bytes()==(ROOT/'frontend'/'assets'/'tacurong-street-network.json').read_bytes()
print(json.dumps({'route_paths':72,'grid_segments':len(data['gridSegments']),'tiers':sorted(tiers),'runtime_overpass_dependency':False,'frontend_public_parity':True},indent=2))
