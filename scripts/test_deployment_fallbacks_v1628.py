from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
planning=json.loads((PUBLIC/'assets/wattzan-planning-data.json').read_text(encoding='utf-8'))
soup=BeautifulSoup((PUBLIC/'index.html').read_text(encoding='utf-8'),'html.parser')
for tag in soup.find_all('script'): tag.decompose()
for tag in soup.find_all('link'): tag.decompose()
fetch_stub=f'''const __planning={json.dumps(planning,separators=(',',':'))};
window.fetch=async function(input,options){{const url=String(input&&input.url?input.url:input);
 if(url.includes('wattzan-planning-data.json')) return new Response(JSON.stringify(__planning),{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('sultan-kudarat-municipalities.json')) return new Response('{{"type":"FeatureCollection","features":[]}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/health')||url.endsWith('/health')) return new Response('{{"status":"healthy","version":"16.2.8"}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/models/status')||url.endsWith('/models/status')) return new Response('{{"production_ready":true}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/models/performance')||url.endsWith('/models/performance')) return new Response('{{"model_metrics":[]}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/data/active')||url.endsWith('/data/active')) return new Response('{{"active_dataset_name":"test.csv"}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/data/municipalities')||url.endsWith('/data/municipalities')) return new Response('{{"municipalities":[]}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/data/summary')||url.endsWith('/data/summary')) return new Response('{{"annual_consumption_by_municipality_kwh":{{}}}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/forecast/history')||url.includes('/forecast/history')) return new Response('{{"forecasts":[]}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('/api/chatbot/status')||url.endsWith('/chatbot/status')) return new Response('{{"configured":false}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(url.includes('open-meteo.com')||url.includes('overpass')) throw new TypeError('simulated external network block');
 return new Response('{{}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
}};'''
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1100})
    errors=[]; console_errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('console',lambda m: console_errors.append(m.text) if m.type=='error' else None)
    page.set_content(str(soup),wait_until='domcontentloaded')
    page.add_style_tag(content=(PUBLIC/'styles.css').read_text(encoding='utf-8'))
    # Deliberately do NOT provide Chart.js, Leaflet, Three.js, Hammer, or Lucide.
    page.add_script_tag(content=fetch_stub)
    page.add_script_tag(content=(PUBLIC/'app.js').read_text(encoding='utf-8'))
    page.wait_for_timeout(900)
    page.evaluate('document.querySelector(`[data-page-target="tacurong-routes"]`).click()')
    page.wait_for_timeout(300)
    assert page.locator('#route-select option').count() >= 73
    assert page.locator('#tacurong-route-map svg').count() >= 1
    assert 'Built-in Tacurong utility map' in page.locator('#route-road-status').inner_text()
    page.select_option('#route-select', index=3)
    page.locator('#route-forecast-button').click()
    page.wait_for_timeout(900)
    assert page.locator('#route-forecast-results').is_visible()
    # Chart.js is absent: all route and route-weather charts must have native SVG fallbacks.
    native_count=page.locator('#route-forecast-results .native-chart-fallback svg').count()
    assert native_count >= 6, native_count
    # Compact planning asset must have expanded the full current route set and weather data.
    assert page.locator('#routes-active-count').inner_text().strip() == '72'
    assert not errors, errors
    assert not console_errors, console_errors
    print(json.dumps({'route_options':page.locator('#route-select option').count(),'native_route_map_svg':page.locator('#tacurong-route-map svg').count(),'native_chart_svgs':native_count,'route_status':page.locator('#route-road-status').inner_text(),'page_errors':errors,'console_errors':console_errors},indent=2))
    browser.close()
