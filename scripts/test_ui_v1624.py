from playwright.sync_api import sync_playwright
from pathlib import Path
from bs4 import BeautifulSoup
import json
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
chart_stub=r'''window.Chart=function(ctx,config){this.ctx=ctx;this.config=config;this.data=config.data||{};this.options=config.options||{};this.destroy=function(){};this.update=function(){};this.resetZoom=function(){};};window.Chart.registry={plugins:{get:function(){return {};}}};window.Hammer=function(){};window.lucide={createIcons:function(){}};'''
leaflet_stub=r'''(function(){window.__polylineCalls=[];function layer(){return {addTo:function(){return this;},bindTooltip:function(){return this;},on:function(){return this;},setLatLng:function(){return this;},getLatLng:function(){return {lat:6.69,lng:124.67};},remove:function(){return this;}}}function map(){return {setView:function(){return this;},on:function(){return this;},invalidateSize:function(){return this;},fitBounds:function(){return this;},removeLayer:function(){return this;},getPane:function(){return null;}}}window.L={map:function(){return map();},tileLayer:function(){return layer();},polyline:function(path,options){window.__polylineCalls.push({path:path,options:options||{}});return layer();},marker:function(){return layer();},circleMarker:function(){return layer();},latLngBounds:function(){return {pad:function(){return this;}}},DomEvent:{stopPropagation:function(){}}};})();'''

def synthetic_overpass():
    elements=[]; wid=1
    lats=[round(6.64+i*.005,6) for i in range(22)]
    lngs=[round(124.64+i*.005,6) for i in range(19)]
    for j,lat in enumerate(lats):
        elements.append({'type':'way','id':wid,'tags':{'highway':'residential','name':f'Local Road {j}'},'geometry':[{'lat':lat,'lon':lng} for lng in lngs]}); wid+=1
    for j,lng in enumerate(lngs):
        highway='primary' if j in (7,8,9) else 'secondary'
        elements.append({'type':'way','id':wid,'tags':{'highway':highway,'name':f'Grid Avenue {j}'},'geometry':[{'lat':lat,'lon':lng} for lat in lats]}); wid+=1
    return {'elements':elements}

def main():
    soup=BeautifulSoup((PUBLIC/'index.html').read_text(encoding='utf-8'),'html.parser')
    for tag in soup.find_all('script'): tag.decompose()
    for tag in soup.find_all('link'): tag.decompose()
    planning=json.loads((PUBLIC/'assets/wattzan-planning-data.json').read_text(encoding='utf-8'))
    fetch_stub=f'''const __planning={json.dumps(planning,separators=(',',':'))}; const __overpass={json.dumps(synthetic_overpass(),separators=(',',':'))};
window.fetch=async function(input){{const url=String(input && input.url ? input.url : input); if(url.includes('wattzan-planning-data.json')) return new Response(JSON.stringify(__planning),{{status:200,headers:{{'Content-Type':'application/json'}}}}); if(url.includes('sultan-kudarat-municipalities.json')) return new Response('{{"type":"FeatureCollection","features":[]}}',{{status:200,headers:{{'Content-Type':'application/json'}}}}); if(url.includes('overpass-api.de')||url.includes('overpass.kumi.systems')) return new Response(JSON.stringify(__overpass),{{status:200,headers:{{'Content-Type':'application/json'}}}}); if(url.includes('/api/health')) return new Response('{{"status":"healthy","version":"16.2.4"}}',{{status:200,headers:{{'Content-Type':'application/json'}}}}); if(url.includes('/api/')) return new Response('{{"detail":"offline smoke test"}}',{{status:503,headers:{{'Content-Type':'application/json'}}}}); return new Response('',{{status:404}});}};'''
    app_js=(PUBLIC/'app.js').read_text(encoding='utf-8')
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':1100})
        errors=[]; consoles=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.on('console',lambda m: consoles.append((m.type,m.text)) if m.type=='error' else None)
        page.set_content(str(soup),wait_until='domcontentloaded'); page.add_style_tag(content='.hidden{display:none!important}[hidden]{display:none!important}')
        page.add_script_tag(content=chart_stub); page.add_script_tag(content=leaflet_stub); page.add_script_tag(content=fetch_stub); page.add_script_tag(content=app_js)
        page.wait_for_timeout(900)
        page.evaluate('document.querySelector(`[data-page-target="tacurong-routes"]`).click()')
        page.wait_for_timeout(900)
        page.evaluate('window.__polylineCalls=[]; document.querySelector("#route-map-year").dispatchEvent(new Event("change", {bubbles:true}))')
        page.wait_for_timeout(120)
        calls=page.evaluate('window.__polylineCalls')
        grid=[c for c in calls if 'utility-grid-segment' in str(c.get('options',{}).get('className',''))]
        branches=[c for c in calls if c.get('options',{}).get('className')=='route-service-branch']
        old_full=[c for c in calls if c.get('options',{}).get('className')=='route-road-grid-route']
        assert 120 <= len(grid) <= 230, len(grid)
        assert len(branches) == 0, len(branches)
        assert len(old_full)==0, len(old_full)
        # Current default network shows only shared road-aligned corridors; local branches are hidden until zoom/selection.
        # Verify a large sample contains finite, non-zero road segments and multiple directions.
        checked=0; angle_bins=set()
        import math
        for c in grid[:180]:
            path=c['path']
            if len(path)!=2: continue
            a,b=path
            dy=float(b[0])-float(a[0]); dx=float(b[1])-float(a[1])
            assert math.isfinite(dx) and math.isfinite(dy) and abs(dx)+abs(dy)>1e-8, (a,b)
            angle_bins.add(round((math.degrees(math.atan2(dy,dx))%180)/15))
            checked += 1
        assert checked >= 80, checked
        assert len(angle_bins) >= 4, angle_bins
        # Route workflow remains explicit: selection enables forecast, does not auto-reveal forecast.
        page.select_option('#route-select', index=3); page.wait_for_timeout(120)
        assert page.locator('#route-forecast-button').is_enabled()
        assert page.locator('#route-forecast-results').is_hidden()
        page.locator('#route-forecast-button').click(); page.wait_for_timeout(900)
        assert page.locator('#route-forecast-results').is_visible()
        calls2=page.evaluate('window.__polylineCalls')
        selected=[c for c in calls2 if c.get('options',{}).get('className')=='route-selected-road-line']
        assert selected and selected[-1]['options'].get('weight',0)>=5.5

        # Clear route and verify explicit workflow resets cleanly.
        page.locator('#route-clear-selection').click(); page.wait_for_timeout(80)
        assert page.locator('#route-select').input_value()==''
        assert page.locator('#route-forecast-button').is_disabled()
        assert page.locator('#route-forecast-results').is_hidden()
        # Every main page remains navigable after the map changes.
        page_targets=['overview','forecast','long-term-forecast','tacurong-routes','forecast-history','recommendations','system-information','model-performance','data-management','about']
        for target in page_targets:
            page.evaluate('(t)=>document.querySelector(`[data-page-target="${t}"]`).click()', target)
            page.wait_for_timeout(40)
            assert page.locator(f'section[data-page="{target}"]').get_attribute('hidden') is None, target

        status=page.locator('#route-road-status').inner_text()
        key_text=page.locator('.route-network-key').inner_text()
        years=page.locator('#overview-map-year option').all_text_contents()
        assert years[0]=='2016' and years[-1]=='2026', years
        assert 'Main trunk' in key_text and 'Local branch' in key_text
        result={'utility_grid_segments':len(grid),'route_terminal_branches':len(branches),'old_full_route_spokes':len(old_full),'road_segments_checked':checked,'status':status,'legend':key_text.replace('\n',' | '),'overview_years':[years[0],years[-1]],'navigated_pages':page_targets,'page_errors':errors,'console_errors':consoles}
        print(json.dumps(result,indent=2))
        assert not errors, errors
        assert not consoles, consoles
        browser.close()
if __name__=='__main__': main()
