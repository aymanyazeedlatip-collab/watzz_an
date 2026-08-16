from pathlib import Path
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import json

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
planning=json.loads((PUBLIC/'assets/wattzan-planning-data.json').read_text(encoding='utf-8'))

chart_stub=r'''
window.__charts={};
window.Chart=function(ctx,config){const id=ctx&&ctx.canvas?ctx.canvas.id:'unknown';window.__charts[id]=config;this.ctx=ctx;this.config=config;this.data=config.data||{};this.options=config.options||{};this.destroy=function(){};this.update=function(){};this.resetZoom=function(){};};
window.Chart.registry={plugins:{get:function(){return {};}}};
window.Hammer=function(){};window.lucide={createIcons:function(){}};
'''
leaflet_stub=r'''
(function(){window.__maps={};function layer(latlng){return {addTo:function(){return this;},bindTooltip:function(){return this;},on:function(){return this;},setLatLng:function(x){latlng=x;return this;},getLatLng:function(){return Array.isArray(latlng)?{lat:latlng[0],lng:latlng[1]}:{lat:6.692,lng:124.676};},remove:function(){return this;}}}function map(id){const obj={handlers:{},setView:function(){return this;},on:function(ev,fn){this.handlers[ev]=fn;return this;},invalidateSize:function(){return this;},fitBounds:function(){return this;},removeLayer:function(){return this;},getPane:function(){return null;},panTo:function(){return this;}};window.__maps[id]=obj;return obj;}window.L={map:function(id){return map(id);},tileLayer:function(){return layer();},polyline:function(){return layer();},marker:function(latlng){return layer(latlng);},circleMarker:function(latlng){return layer(latlng);},latLngBounds:function(){return {pad:function(){return this;}}},DomEvent:{stopPropagation:function(){}}};})();
'''

soup=BeautifulSoup((PUBLIC/'index.html').read_text(encoding='utf-8'),'html.parser')
for tag in soup.find_all('script'): tag.decompose()
for tag in soup.find_all('link'): tag.decompose()

fetch_stub=f'''
const __planning={json.dumps(planning,separators=(',',':'))};
window.__weatherRequests=[];
function __dateRows(startDate,endDate){{
  const out=[]; let d=new Date(startDate+'T00:00:00Z'); const end=new Date(endDate+'T00:00:00Z');
  while(d<=end){{out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1);}}
  const n=out.length;
  return {{daily:{{time:out,temperature_2m_mean:Array(n).fill(28.2),temperature_2m_min:Array(n).fill(23.6),temperature_2m_max:Array(n).fill(33.1),apparent_temperature_mean:Array(n).fill(32.0),relative_humidity_2m_mean:Array(n).fill(78),precipitation_sum:Array(n).fill(4.2),wind_speed_10m_mean:Array(n).fill(6.1),cloud_cover_mean:Array(n).fill(67)}}}};
}}
window.fetch=async function(input,options){{
 const url=String(input&&input.url?input.url:input);
 if(url.includes('wattzan-planning-data.json')) return new Response(JSON.stringify(__planning),{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('sultan-kudarat-municipalities.json')) return new Response('{{"type":"FeatureCollection","features":[]}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('archive-api.open-meteo.com')||url.includes('api.open-meteo.com')){{
   const u=new URL(url); const kind=url.includes('archive-api')?'archive':'forecast';
   const entry={{kind,start:performance.now(),startDate:u.searchParams.get('start_date'),endDate:u.searchParams.get('end_date')}};window.__weatherRequests.push(entry);
   await new Promise(r=>setTimeout(r,120)); entry.end=performance.now();
   if(kind==='archive') return new Response(JSON.stringify({{error:true,reason:'simulated archive outage'}}),{{status:503,headers:{{'Content-Type':'application/json'}}}});
   return new Response(JSON.stringify(__dateRows(entry.startDate,entry.endDate)),{{status:200,headers:{{'Content-Type':'application/json'}}}});
 }}
 if(url.includes('/api/forecast/next-date')||url.includes('/forecast/next-date')) return new Response(JSON.stringify({{municipality:'Tacurong City',last_model_state_date:'2024-12-31',next_sequential_date:'2025-01-01'}}),{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/forecast/current-day')||url.endsWith('/forecast/current-day')){{
   const body=JSON.parse(options&&options.body||'{{}}'); window.__currentDayPayload=body;
   return new Response(JSON.stringify({{forecast_id:'fasttest',municipality:'Tacurong City',forecast_date:body.target_date,forecast_type:'current_day_gap_bridge_scenario',bridge_days_count:592,bridge_weather_source:body.bridge_weather_source,bridge_used_climatology_fallback:body.bridge_used_climatology_fallback,mlr_prediction_kwh:150000,sarima_prediction_kwh:151000,hybrid_prediction_kwh:150500,selected_prediction_kwh:150500,estimated_peak_demand_kw:9000,capacity_utilization_pct:null,demand_level:'NORMAL',reason_codes:[],recommended_actions:['Continue monitoring demand.'],data_warning:'test',expert_validation_required:true}}),{{status:200,headers:{{'Content-Type':'application/json'}}}});
 }}
 if(url.includes('/api/health')||url.endsWith('/health')) return new Response('{{"status":"healthy","version":"16.2.7"}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/models/status')||url.endsWith('/models/status')) return new Response('{{"production_ready":true}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/models/performance')||url.endsWith('/models/performance')) return new Response('{{"model_metrics":[]}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/data/active')||url.endsWith('/data/active')) return new Response('{{"active_dataset_name":"test.csv"}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/data/municipalities')||url.endsWith('/data/municipalities')) return new Response('{{"municipalities":[]}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/data/summary')||url.endsWith('/data/summary')) return new Response('{{"annual_consumption_by_municipality_kwh":{{}}}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/forecast/history')||url.includes('/forecast/history')) return new Response('{{"forecasts":[]}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/chatbot/status')||url.endsWith('/chatbot/status')) return new Response('{{"configured":false}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 return new Response('{{}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
}};
'''

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1500,'height':1000})
    errors=[]; console_errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('console',lambda m: console_errors.append(m.text) if m.type=='error' else None)
    page.set_content(str(soup),wait_until='domcontentloaded')
    page.add_style_tag(content=(PUBLIC/'styles.css').read_text(encoding='utf-8'))
    page.add_script_tag(content=chart_stub);page.add_script_tag(content=leaflet_stub);page.add_script_tag(content=fetch_stub);page.add_script_tag(content=(PUBLIC/'app.js').read_text(encoding='utf-8'))
    page.wait_for_timeout(700)
    page.evaluate('document.querySelector(`[data-page-target="forecast"]`).click()')
    page.wait_for_timeout(100)
    page.evaluate("window.__maps['shortterm-map'].handlers.click({latlng:{lat:6.692,lng:124.676}})")
    page.wait_for_timeout(100)
    page.fill('#one-forecast-date','2026-08-16')
    start=page.evaluate('performance.now()')
    page.locator('#shortterm-fetch-run-button').click()
    page.wait_for_function("document.querySelector('#shortterm-automation-status').classList.contains('success')",timeout=5000)
    elapsed=page.evaluate('(s)=>performance.now()-s',start)
    requests=page.evaluate('window.__weatherRequests')
    payload=page.evaluate('window.__currentDayPayload')
    assert len(requests)==2,requests
    kinds=sorted(r['kind'] for r in requests); assert kinds==['archive','forecast'],kinds
    start_spread=max(r['start'] for r in requests)-min(r['start'] for r in requests)
    assert start_spread<150, start_spread
    assert elapsed<5000,elapsed
    assert len(payload['days'])>580,len(payload['days'])
    assert payload['bridge_used_climatology_fallback'] is True
    assert 'climatology' in payload['bridge_weather_source'].lower()
    assert 0 <= payload['days'][0]['rainfall_mm'] < 20, payload['days'][0]['rainfall_mm']
    assert not errors,errors
    assert not console_errors,console_errors
    print(json.dumps({'scenario_total_ms':round(elapsed,1),'weather_requests':requests,'request_start_spread_ms':round(start_spread,1),'bridge_days_payload':len(payload['days']),'page_errors':errors,'console_errors':console_errors},indent=2))
    browser.close()
