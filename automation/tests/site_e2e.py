# End-to-end test of the lead flow. Serve the repo first:  python3 -m http.server 8765
# then:  python3 automation/tests/site_e2e.py   (needs: pip install playwright; a Chrome at /usr/bin/google-chrome)
import json, re, sys, time
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765'
EP = 'https://script.google.com/macros/s/TEST-DEPLOYMENT/exec'
results = []
def check(name, cond, info=''):
    results.append((name, bool(cond), info)); print(('PASS ' if cond else 'FAIL ') + name + (' :: ' + str(info) if info and not cond else ''))

def setup(page, endpoint=True):
    page.route(re.compile(r'https://fonts\.(googleapis|gstatic)\.com/.*'), lambda r: r.abort())
    page.route(re.compile(r'https://(wa\.me|api\.whatsapp\.com)/.*'), lambda r: r.fulfill(status=200, body='wa'))
    if endpoint:
        def patch(route):
            body = open('assets/quote.js', encoding='utf-8').read().replace("var LEAD_ENDPOINT = '';", "var LEAD_ENDPOINT = '%s';" % EP)
            route.fulfill(status=200, body=body, headers={'content-type': 'application/javascript'})
        page.route(re.compile(r'.*/assets/quote\.js.*'), patch)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, locale='ar-SA')
    page = ctx.new_page()
    errors = []; page.on('pageerror', lambda e: errors.append(str(e)) if 'ViewTransition' not in str(e) else None)  # aborted view transitions on fast test navigation are not errors
    posted = []
    setup(page)
    def ep(route):
        posted.append(route.request.post_data)
        route.fulfill(status=200, body=json.dumps({'ok': True, 'ref': 'L-TEST-0001'}), headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
    page.route(EP, ep)

    # 1. land on an article from a LinkedIn post
    page.goto(BASE + '/writing/bars-per-tonne/?utm_source=linkedin&utm_medium=social&utm_campaign=series-1&utm_content=c01-bars-per-tonne')
    attr = page.evaluate("JSON.parse(localStorage.getItem('mash_attr_v1'))")
    check('UTM kept from the LinkedIn landing page', attr['first']['utm_content'] == 'c01-bars-per-tonne' and attr['first']['landing'] == '/writing/bars-per-tonne/', attr)

    # 2. WhatsApp click counted, link unchanged
    href_before = page.eval_on_selector('.q-fab', 'a => a.href')
    with page.expect_request(lambda r: r.url == EP and r.method == 'POST') as req:
        page.click('.q-fab')
    ev = json.loads(req.value.post_data)
    check('WhatsApp click sends one event with the post', ev['type'] == 'wa_click' and ev['utm_content'] == 'c01-bars-per-tonne' and ev['kind'] == 'event', ev)
    check('WhatsApp link not changed', href_before == 'https://wa.me/message/D6ABM7QFWVSPB1', href_before)
    for pg in ctx.pages[1:]: pg.close()

    # 3. calculator -> two lines -> official quotation button
    page.goto(BASE + '/ar/tools/rebar-weight/')
    page.click('.calc-chip[data-d="16"]'); page.fill('#cTon', '40'); page.dispatch_event('#cTon', 'input'); page.click('#cAdd')
    page.click('.calc-chip[data-d="20"]'); page.fill('#cTon', '60'); page.dispatch_event('#cTon', 'input'); page.click('#cAdd')
    rows = page.eval_on_selector_all('#cRows tr', 'r => r.length')
    check('calculator order has 2 lines', rows == 2, rows)
    check('both buttons present (official quote + WhatsApp)', page.is_visible('#cRfq') and page.is_visible('#cQuote'))
    page.click('#cRfq'); page.wait_for_url(re.compile(r'/ar/quote/\?'))
    url = page.url
    check('quote URL carries diameters', 't16=' in url and 't20=' in url and 'from=calculator' in url, url)
    v16 = page.input_value('#t16'); v20 = page.input_value('#t20')
    check('form prefilled from calculator', abs(float(v16) - 40) < 0.6 and abs(float(v20) - 60) < 0.6, (v16, v20))
    check('calculator notice shown', page.is_visible('#rfqFromCalc'))

    # 4. validation in Arabic
    page.click('#rfqSend')
    check('missing fields -> Arabic error', 'أكمل الحقول' in page.inner_text('#rfqMsg'), page.inner_text('#rfqMsg'))
    page.fill('#fName', 'عميل تجريبي'); page.fill('#fCompany', 'شركة تجريبية للمقاولات'); page.fill('#fPosition', 'مدير المشتريات')
    page.fill('#fPhone', '٠٥٠٠٠٠٠٠٠١'); page.select_option('#fCity', 'الرياض'); page.select_option('#fGrade', '60'); page.select_option('#fStage', 'ready')
    page.check('#fCut')
    page.click('#rfqSend')
    check('no consent -> error', 'وافق' in page.inner_text('#rfqMsg'))
    page.check('#fConsent')
    with page.expect_request(lambda r: r.url == EP and r.method == 'POST') as req2:
        page.click('#rfqSend')
    page.wait_for_selector('#rfqMsg.is-ok')
    body = json.loads(req2.value.post_data)
    check('lead payload: phone normalised from Arabic digits', body['phone'] == '+966500000001', body['phone'])
    check('lead payload: tonnes per diameter', set(body['tonnes']) == {'d16', 'd20'}, body['tonnes'])
    check('lead payload: source post attached', body['utm_content'] == 'c01-bars-per-tonne' and body['first_landing'] == '/writing/bars-per-tonne/', body)
    check('lead payload: no price fields', not any(k for k in body if 'price' in k.lower()))
    check('lead payload: submission id for retry-safety', isinstance(body.get('sid'), str) and len(body['sid']) >= 10, body.get('sid'))
    check('success message shows reference', 'L-TEST-0001' in page.inner_text('#rfqMsg'))

    # 5. fallback when the endpoint is not configured
    page2 = ctx.new_page(); setup(page2, endpoint=False)
    page2.goto(BASE + '/quote/?t25=12')
    page2.fill('#fName', 'Demo'); page2.fill('#fCompany', 'Demo Co'); page2.fill('#fPhone', '0500000002')
    page2.select_option('#fCity', index=1); page2.select_option('#fGrade', '80'); page2.select_option('#fStage', 'comparing'); page2.check('#fConsent')
    page2.click('#rfqSend')
    check('no endpoint -> summary + WhatsApp/email fallback', page2.is_visible('#rfqSummary') and page2.is_visible('#rfqAlt') and 'Ø' not in '' and '25mm 12t' in page2.inner_text('#rfqSummary'), page2.inner_text('#rfqSummary'))
    mailto = page2.get_attribute('#rfqMail', 'href')
    check('fallback email link carries the full request', mailto.startswith('mailto:omar.mashharawi@rajhisteel.com?') and 'Demo%20Co' in mailto, mailto[:120])
    sent_without_ep = [r for r in posted if r and 'Demo Co' in r]
    check('no endpoint -> nothing sent', not sent_without_ep)

    # 6. endpoint answers an error (busy / rate / server) -> visitor still gets the fallback
    page3 = ctx.new_page(); setup(page3)
    page3.route(EP, lambda r: r.fulfill(status=200, body=json.dumps({'ok': False, 'error': 'busy'}), headers={'content-type': 'application/json', 'access-control-allow-origin': '*'}))
    page3.goto(BASE + '/ar/quote/?t12=5')
    page3.fill('#fName', 'عميل'); page3.fill('#fCompany', 'شركة'); page3.fill('#fPhone', '0500000004')
    page3.select_option('#fCity', index=1); page3.select_option('#fGrade', '60'); page3.select_option('#fStage', 'budget'); page3.check('#fConsent')
    page3.click('#rfqSend'); page3.wait_for_selector('#rfqSummary:not([hidden])')
    check('server error -> summary + WhatsApp/email fallback', page3.is_visible('#rfqAlt') and '12مم 5طن' in page3.inner_text('#rfqSummary'), page3.inner_text('#rfqSummary'))
    check('no JavaScript errors', not errors, errors)
    b.close()
fails = [r for r in results if not r[1]]
print(f'\n{len(results)-len(fails)}/{len(results)} passed')
sys.exit(1 if fails else 0)
