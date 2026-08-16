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

def setup_page(page, planning, overpass_mode='second_success'):
    soup=BeautifulSoup((PUBLIC/'index.html').read_text(encoding='utf-8'),'html.parser')
    for tag in soup.find_all('script'): tag.decompose()
    for tag in soup.find_all('link'): tag.decompose()
    overpass=json.dumps(synthetic_overpass(),separators=(',',':'))
    planning_json=json.dumps(planning,separators=(',',':'))
    behavior = "if(url.includes(\"overpass-api.de\")) throw new Error(\"primary down\"); return new Response(JSON.stringify(__overpass),{status:200,headers:{\"Content-Type\":\"application/json\"}});" if overpass_mode=="second_success" else "throw new Error(\"all road sources down\");"
    fetch_stub = "const __planning=" + planning_json + "; const __overpass=" + overpass + "; window.__roadFetches=[];\n" + f"""window.fetch=async function(input,opts={{}}){{const url=String(input && input.url ? input.url : input); if(url.includes('wattzan-planning-data.json')) return new Response(JSON.stringify(__planning),{{status:200,headers:{{'Content-Type':'application/json'}}}}); if(url.includes('sultan-kudarat-municipalities.json')) return new Response('{{\"type\":\"FeatureCollection\",\"features\":[]}}',{{status:200,headers:{{'Content-Type':'application/json'}}}}); if(url.includes('overpass-api.de')||url.includes('overpass.private.coffee')){{window.__roadFetches.push({{url,method:opts.method||'GET',body:String(opts.body||'')}}); {behavior} }} if(url.includes('/api/health')) return new Response('{{\"status\":\"healthy\",\"version\":\"16.2.9\"}}',{{status:200,headers:{{'Content-Type':'application/json'}}}}); if(url.includes('/api/')) return new Response('{{\"detail\":\"offline smoke test\"}}',{{status:503,headers:{{'Content-Type':'application/json'}}}}); return new Response('',{{status:404}});}};"""
    page.set_content(str(soup),wait_until='domcontentloaded')
    page.add_style_tag(content='.hidden{display:none!important}[hidden]{display:none!important}')
    page.add_script_tag(content=chart_stub)
    page.add_script_tag(content=leaflet_stub)
    page.add_script_tag(content=fetch_stub)
    page.add_script_tag(content=(PUBLIC/'app.js').read_text(encoding='utf-8'))
    page.wait_for_timeout(700)
    page.evaluate('document.querySelector(`[data-page-target="tacurong-routes"]`).click()')

def main():
    planning=json.loads((PUBLIC/'assets/wattzan-planning-data.json').read_text(encoding='utf-8'))
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        # Success through the current secondary Overpass endpoint.
        page=browser.new_page(viewport={'width':1440,'height':1050})
        errors=[]; page.on('pageerror',lambda e: errors.append(str(e)))
        setup_page(page, planning, 'second_success')
        page.wait_for_timeout(1200)
        fetches=page.evaluate('window.__roadFetches')
        assert len(fetches)==2, fetches
        assert fetches[0]['method']=='POST' and fetches[1]['method']=='POST', fetches
        assert 'data=' in fetches[1]['body'], fetches[1]
        calls=page.evaluate('window.__polylineCalls')
        grid=[c for c in calls if 'utility-grid-segment' in str(c.get('options',{}).get('className',''))]
        sparse=[c for c in calls if c.get('options',{}).get('className') in ('route-road-grid-route','route-service-branch')]
        assert len(grid)>=100, len(grid)
        assert 'Street-aligned utility grid' in page.locator('#route-road-status').inner_text()
        assert page.locator('#route-road-retry').is_hidden()
        assert not errors, errors
        # Failure: never render the old sparse Leaflet fallback. Keep map clean + retry action.
        page2=browser.new_page(viewport={'width':1440,'height':1050})
        errors2=[]; page2.on('pageerror',lambda e: errors2.append(str(e)))
        setup_page(page2, planning, 'all_fail')
        page2.wait_for_timeout(1200)
        calls2=page2.evaluate('window.__polylineCalls')
        fallback_grid=[c for c in calls2 if 'utility-grid-segment' in str(c.get('options',{}).get('className',''))]
        fallback_branches=[c for c in calls2 if c.get('options',{}).get('className')=='route-service-branch']
        assert len(fallback_grid)==0, len(fallback_grid)
        assert len(fallback_branches)==0, len(fallback_branches)
        assert 'unavailable' in page2.locator('#route-road-status').inner_text().lower()
        assert page2.locator('#route-road-retry').is_visible()
        assert not errors2, errors2
        print(json.dumps({'success_grid_segments':len(grid),'road_requests':fetches,'failure_sparse_grid_segments':len(fallback_grid),'failure_sparse_route_branches':len(fallback_branches),'failure_status':page2.locator('#route-road-status').inner_text(),'errors':errors+errors2},indent=2))
        browser.close()
if __name__=='__main__': main()
