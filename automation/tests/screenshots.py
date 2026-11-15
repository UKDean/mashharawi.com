# Desktop + mobile screenshots of the key pages. Serve the repo on :8765 first. Fonts: npm i @fontsource/ibm-plex-sans-arabic @fontsource/inter @fontsource/ibm-plex-mono in the folder set as FD.
# Usage: python3 automation/tests/screenshots.py
import re, os, glob
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765'; import os as _o; OUT=_o.environ.get('SHOTS_OUT','shots'); FD=_o.environ.get('FONTSOURCE','node_modules/@fontsource'); _o.makedirs(OUT, exist_ok=True)
faces=[]
def add(fam, pkg, prefix, weights, subsets):
    for w in weights:
        for sub in subsets:
            f=f'{FD}/{pkg}/files/{prefix}-{sub}-{w}-normal.woff2'
            if os.path.exists(f): faces.append(f"@font-face{{font-family:'{fam}';font-weight:{w};font-style:normal;font-display:block;src:url('/__fonts/{pkg}/files/{os.path.basename(f)}') format('woff2')}}")
add('IBM Plex Sans Arabic','ibm-plex-sans-arabic','ibm-plex-sans-arabic',[200,300,400,500],['arabic','latin'])
add('Inter','inter','inter',[200,300,400,500],['latin'])
add('IBM Plex Mono','ibm-plex-mono','ibm-plex-mono',[400,500],['latin'])
CSS='\n'.join(faces)
def setup(page):
    page.route(re.compile(r'https://fonts\.googleapis\.com/.*'), lambda r: r.fulfill(status=200, body=CSS, headers={'content-type':'text/css'}))
    page.route(re.compile(r'https://fonts\.gstatic\.com/.*'), lambda r: r.abort())
    page.route(re.compile(r'.*/__fonts/.*'), lambda r: r.fulfill(status=200, path=FD+'/'+r.request.url.split('/__fonts/')[1], headers={'content-type':'font/woff2'}))
    page.route(re.compile(r'https://(wa\.me|cdnjs\.cloudflare\.com)/.*'), lambda r: r.abort())
PAGES=[('ar-rebar','/ar/rebar/'),('en-rebar','/rebar/'),('zh-rebar','/zh/rebar/'),
       ('ar-quote','/ar/quote/?t16=40&t20=60&from=calculator'),('en-quote','/quote/?t25=12'),
       ('ar-calculator','/ar/tools/rebar-weight/'),('ar-home','/ar/'),('en-home','/')]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    for dev,vp,mob in [('desktop',{'width':1366,'height':900},False),('mobile',{'width':390,'height':844},True)]:
        ctx=b.new_context(viewport=vp,device_scale_factor=2 if mob else 1,is_mobile=mob,has_touch=mob,reduced_motion='reduce')
        for name,path in PAGES:
            pg=ctx.new_page(); setup(pg)
            pg.goto(BASE+path, wait_until='load'); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(400)
            if name=='ar-calculator':
                pg.click('.calc-chip[data-d="16"]'); pg.fill('#cTon','40'); pg.dispatch_event('#cTon','input'); pg.click('#cAdd')
                pg.click('.calc-chip[data-d="20"]'); pg.fill('#cTon','60'); pg.dispatch_event('#cTon','input'); pg.click('#cAdd')
                pg.locator('#cRfq').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
                pg.screenshot(path=f'{OUT}/{name}-{dev}.png')
            elif name.endswith('home'):
                pg.locator('.fx-mq').first.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
                pg.screenshot(path=f'{OUT}/{name}-ticker-{dev}.png')
            elif 'quote' in name:
                pg.screenshot(path=f'{OUT}/{name}-{dev}.png', full_page=True)
            else:
                pg.screenshot(path=f'{OUT}/{name}-{dev}.png')
                pg.locator('#r-spec, #z-spec').first.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
                pg.screenshot(path=f'{OUT}/{name}-spec-{dev}.png')
            # layout sanity: horizontal overflow on mobile
            ov=pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            print(dev,name,'h-overflow px:',ov)
            pg.close()
        ctx.close()
    b.close()
