from playwright.sync_api import sync_playwright
from pathlib import Path
from bs4 import BeautifulSoup
import json
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
chart_stub=r'''window.Chart=function(ctx,config){this.ctx=ctx;this.config=config;this.data=config.data||{};this.options=config.options||{};this.destroy=function(){};this.update=function(){};this.resetZoom=function(){};};window.Chart.registry={plugins:{get:function(){return {};}}};window.Hammer=function(){};window.lucide={createIcons:function(){}};'''
leaflet_stub=r'''(function(){window.__polylineCalls=[];function layer(){return {addTo:function(){return this;},bindTooltip:function(){return this;},on:function(){return this;},setLatLng:function(){return this;},getLatLng:function(){return {lat:6.69,lng:124.67};},remove:function(){return this;}}}function map(){return {setView:function(){return this;},on:function(){return this;},invalidateSize:function(){return this;},fitBounds:function(){return this;},removeLayer:function(){return this;},getPane:function(){return null;}}}window.L={map:function(){return map();},tileLayer:function(){return layer();},polyline:function(path,options){window.__polylineCalls.push({path:path,options:options||{}});return layer();},marker:function(){return layer();},circleMarker:function(){return layer();},latLngBounds:function(){return {pad:function(){return this;}}},DomEvent:{stopPropagation:function(){}}};})();'''
def main():
    planning=json.loads((PUBLIC/'assets/wattzan-planning-data.json').read_text(encoding='utf-8'))
    soup=BeautifulSoup((PUBLIC/'index.html').read_text(encoding='utf-8'),'html.parser')
    for tag in soup.find_all('script'): tag.decompose()
    for tag in soup.find_all('link'): tag.decompose()
    planning_json=json.dumps(planning,separators=(',',':'))
    fetch_stub="const __planning="+planning_json+"; window.__externalRoadFetches=[]; window.fetch=async function(input,opts={}){const url=String(input&&input.url?input.url:input); if(url.includes('wattzan-planning-data.json')) return new Response(JSON.stringify(__planning),{status:200,headers:{'Content-Type':'application/json'}}); if(url.includes('sultan-kudarat-municipalities.json')) return new Response('{\"type\":\"FeatureCollection\",\"features\":[]}',{status:200,headers:{'Content-Type':'application/json'}}); if(url.includes('overpass')||url.includes('openstreetmap.org/api')){window.__externalRoadFetches.push(url); throw new Error('external road network forbidden in v16.3.0');} if(url.includes('/api/health')) return new Response('{\"status\":\"healthy\",\"version\":\"16.3.0\"}',{status:200,headers:{'Content-Type':'application/json'}}); if(url.includes('/api/')) return new Response('{\"detail\":\"offline smoke test\"}',{status:503,headers:{'Content-Type':'application/json'}}); return new Response('',{status:404});};"
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':1050})
        errors=[]; console=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m: console.append(m.text) if m.type=='error' else None)
        page.set_content(str(soup),wait_until='domcontentloaded')
        page.add_style_tag(content='.hidden{display:none!important}[hidden]{display:none!important}')
        page.add_script_tag(content=chart_stub);page.add_script_tag(content=leaflet_stub);page.add_script_tag(content=fetch_stub)
        page.add_script_tag(content=(PUBLIC/'app.js').read_text(encoding='utf-8'))
        page.wait_for_timeout(700)
        page.evaluate('document.querySelector(`[data-page-target="tacurong-routes"]`).click()')
        page.wait_for_timeout(700)
        calls=page.evaluate('window.__polylineCalls')
        grid=[c for c in calls if 'utility-grid-segment' in str(c.get('options',{}).get('className',''))]
        branches=[c for c in calls if c.get('options',{}).get('className')=='route-service-branch']
        assert len(grid)>=300, len(grid)
        assert len(branches)>0, len(branches)
        assert page.locator('#route-road-retry').is_hidden()
        assert 'Street-aligned utility grid' in page.locator('#route-road-status').inner_text()
        assert page.evaluate('window.__externalRoadFetches')==[], page.evaluate('window.__externalRoadFetches')
        # Route selection must still work with the fully packaged graph.
        page.select_option('#route-select','2519');page.wait_for_timeout(100)
        selected=[c for c in page.evaluate('window.__polylineCalls') if c.get('options',{}).get('className')=='route-selected-road-line']
        assert selected, 'selected route did not render'
        assert len(selected[-1]['path'])>=2
        assert not errors, errors
        assert not console, console
        print(json.dumps({'grid_segments':len(grid),'route_branches':len(branches),'external_road_fetches':0,'selected_route_points':len(selected[-1]['path']),'status':page.locator('#route-road-status').inner_text(),'errors':errors},indent=2))
        browser.close()
if __name__=='__main__':main()
