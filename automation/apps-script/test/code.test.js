// node --test automation/apps-script/test/code.test.js
const test = require('node:test'), assert = require('node:assert');
const { load, post, get } = require('./harness');

const SECRET = { TELEGRAM_BOT_TOKEN: 'TEST_TOKEN_NOT_REAL', TELEGRAM_CHAT_ID: '123' };
const LIVE = Object.assign({ TEST_MODE: 'false' }, SECRET);
const KEY = 'k'.repeat(40);
let n = 0;
function lead(over = {}) {
  n++;
  return Object.assign({
    kind: 'lead', name: 'عميل تجريبي', company: 'شركة تجريبية', position: 'مدير المشتريات', phone: '+9665000000' + String(n).padStart(2, '0'),
    email: 'demo@example.com', project: 'برج تجريبي', city: 'الرياض', tonnes: { d16: 60, d20: 90, d25: 80 }, total_t: 230,
    grade: '60', cutting: true, epoxy: false, needed_by: '', stage: 'ready', notes: '', consent: true, elapsed_ms: 15000,
    utm_source: 'linkedin', utm_campaign: 'series-1', utm_content: 'c01-bars-per-tonne', first_landing: '/writing/bars-per-tonne/',
    page: '/ar/quote/', lang: 'ar', from_calculator: true, sid: 'S' + n
  }, over);
}
const col = (env, key) => env.ctx.LEAD_COLS.findIndex(c => c[0] === key);
const dataRows = (env, name) => (env.sheets[name] ? env.sheets[name].rows.slice(1) : []);

/* ---------- 1. the public cannot read customer data ---------- */

test('POST answers never contain sheet data (only ok + random ref)', () => {
  const env = load({ props: LIVE });
  post(env, lead({ name: 'Secret Buyer' }));
  const r = post(env, lead());
  assert.deepEqual(Object.keys(r).sort(), ['ok', 'ref']);
  assert.match(r.ref, /^L-\d{6}-[A-Z2-9]{6}$/);                       // random: reveals no lead count
  assert.doesNotMatch(JSON.stringify(r), /Secret Buyer|9665/);
});

test('GET without the export key returns only a health check', () => {
  const env = load({ props: Object.assign({ EXPORT_KEY: KEY }, LIVE) });
  post(env, lead());
  assert.deepEqual(get(env, {}), { ok: true, service: 'mashharawi-leads' });
  assert.deepEqual(get(env, { action: 'export' }), { ok: false, error: 'forbidden' });
  assert.deepEqual(get(env, { action: 'export', key: KEY.slice(1) + 'x' }), { ok: false, error: 'forbidden' });
  assert.deepEqual(get(env, { action: 'list' }), { ok: true, service: 'mashharawi-leads' });
});

test('export stays off when EXPORT_KEY is missing or shorter than 32 characters', () => {
  for (const k of [undefined, '', 'short-key-123']) {
    const props = Object.assign({}, LIVE); if (k !== undefined) props.EXPORT_KEY = k;
    const env = load({ props });
    post(env, lead());
    assert.deepEqual(get(env, { action: 'export', key: k || '' }), { ok: false, error: 'forbidden' });
  }
});

test('every export attempt is written to the Audit sheet', () => {
  const env = load({ props: Object.assign({ EXPORT_KEY: KEY }, LIVE) });
  get(env, { action: 'export', key: 'wrong' });
  get(env, { action: 'export', key: KEY });
  const actions = dataRows(env, 'Audit').map(r => r[1]);
  assert.deepEqual(actions, ['export-denied', 'export']);
});

test('the script never opens another spreadsheet (currentonly scope)', () => {
  const env = load({ props: LIVE });
  assert.equal(post(env, lead()).ok, true);                          // harness openById throws if used
  env.ctx.buildReport(); env.ctx.dailyDigest(); env.ctx.setup();
  const fs = require('fs'), path = require('path');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'appsscript.json'), 'utf8'));
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets.currentonly'));
  assert.ok(!manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets'));
  assert.ok(!manifest.oauthScopes.some(s => /drive/.test(s)));
});

/* ---------- 2. spam and abuse ---------- */

test('rejects malformed and oversized bodies without storing anything', () => {
  const env = load({ props: LIVE });
  assert.deepEqual(post(env, 'not json'), { ok: false, error: 'bad_request' });
  assert.deepEqual(post(env, '[1,2]'), { ok: false, error: 'bad_request' });
  assert.deepEqual(post(env, JSON.stringify(lead({ notes: 'x'.repeat(30000) }))), { ok: false, error: 'too_large' });
  assert.deepEqual(post(env, { kind: 'admin' }), { ok: false, error: 'unknown_kind' });
  assert.equal(env.sheets.Leads, undefined);
});

test('validation: phone, consent, diameters, quantities, required fields, enums, timing', () => {
  const env = load({ props: LIVE });
  const cases = [
    [{ phone: '12' }, 'phone'], [{ consent: false }, 'no_consent'], [{ consent: 'yes' }, 'no_consent'],
    [{ tonnes: { d22: 5 } }, 'diameter'], [{ tonnes: { d16: -1 } }, 'quantity'], [{ tonnes: { d16: 1e9 } }, 'quantity'],
    [{ tonnes: {} }, 'quantity'], [{ tonnes: [5] }, 'quantity'], [{ company: '' }, 'missing'],
    [{ grade: '75' }, 'missing'], [{ stage: 'x' }, 'missing'], [{ elapsed_ms: 900 }, 'too_fast']
  ];
  for (const [o, e] of cases) assert.deepEqual(post(env, lead(o)), { ok: false, error: e }, JSON.stringify(o));
  assert.equal(env.sheets.Leads, undefined);
  assert.equal(env.fetches.length, 0);
});

test('honeypot: bot gets a fake ok, nothing stored or sent', () => {
  const env = load({ props: LIVE });
  assert.equal(post(env, lead({ website: 'http://spam' })).ok, true);
  assert.equal(env.sheets.Leads, undefined);
  assert.equal(env.fetches.length, 0);
});

test('per-phone limit: 4th request in 10 minutes refused, also for the same number written differently', () => {
  const env = load({ props: LIVE });
  assert.equal(post(env, lead({ phone: '+966500000091' })).ok, true);
  assert.equal(post(env, lead({ phone: '0500000091' })).ok, true);
  assert.equal(post(env, lead({ phone: '00966500000091' })).ok, true);
  assert.deepEqual(post(env, lead({ phone: '0500000091' })), { ok: false, error: 'rate' });
});

test('alert flood: after 30 alerts in an hour leads are still stored, alerts held, one notice sent', () => {
  const env = load({ props: LIVE });
  for (let i = 0; i < 35; i++) assert.equal(post(env, lead()).ok, true);
  const rows = dataRows(env, 'Leads');
  assert.equal(rows.length, 35);
  assert.equal(rows.filter(r => r[col(env, 'telegram')] === 'held-alert-cap').length, 5);
  assert.equal(env.fetches.length, 31);                                // 30 alerts + 1 cap notice
});

test('hard ceiling of 200 stored leads per hour', () => {
  const env = load({ props: LIVE });
  let ok = 0;
  for (let i = 0; i < 205; i++) if (post(env, lead()).ok) ok++;
  assert.equal(ok, 200);
});

test('events: only wa_click accepted, capped at 300/hour, never alert', () => {
  const env = load({ props: LIVE });
  assert.equal(post(env, { kind: 'event', type: 'pageview' }).ok, false);
  let ok = 0;
  for (let i = 0; i < 305; i++) if (post(env, { kind: 'event', type: 'wa_click', page: '/x/' }).ok) ok++;
  assert.equal(ok, 300);
  assert.equal(env.fetches.length, 0);
});

test('sheet formula injection is neutralised in every text cell', () => {
  const env = load({ props: LIVE });
  post(env, lead({ company: '=HYPERLINK("http://x","y")', notes: '+cmd', utm_content: '@x' }));
  const r = dataRows(env, 'Leads')[0];
  assert.equal(r[col(env, 'company')], `'=HYPERLINK("http://x","y")`);
  assert.equal(r[col(env, 'notes')], "'+cmd");
  assert.equal(r[col(env, 'utm_content')], "'@x");
});

test('Telegram message escapes HTML from the customer', () => {
  const env = load({ props: LIVE });
  post(env, lead({ name: '<a href="x">click</a>' }));
  assert.match(env.fetches[0].body.text, /&lt;a href="x"&gt;click&lt;\/a&gt;/);
});

/* ---------- 3. no lost requests ---------- */

test('lead is saved before the alert; Telegram failure is recorded, not thrown', () => {
  for (const code of ['throw', 500]) {
    const env = load({ props: LIVE, telegramCode: code });
    assert.equal(post(env, lead()).ok, true);
    assert.match(String(dataRows(env, 'Leads')[0][col(env, 'telegram')]), /telegram-(exception|error-500)/);
  }
});

test('retryAlerts re-sends failed and held alerts, then marks them sent', () => {
  const env = load({ props: LIVE, telegramCode: 500 });
  post(env, lead()); post(env, lead());
  const env2 = env;                                                     // same sheet, Telegram back up:
  env2.ctx.UrlFetchApp.fetch = (url, o) => { env2.fetches.push({ url, body: JSON.parse(o.payload) }); return { getResponseCode: () => 200 }; };
  assert.equal(env2.ctx.retryAlerts(), 2);
  dataRows(env2, 'Leads').forEach(r => assert.equal(r[col(env2, 'telegram')], 'sent'));
  assert.equal(env2.ctx.retryAlerts(), 0);                             // nothing left to resend
});

test('without Telegram settings the lead is still saved', () => {
  const env = load({ props: { TEST_MODE: 'false' } });
  assert.equal(post(env, lead()).ok, true);
  assert.equal(dataRows(env, 'Leads')[0][col(env, 'telegram')], 'no-telegram-config');
});

test('email backup copy when NOTIFY_EMAIL is set', () => {
  const env = load({ props: Object.assign({ NOTIFY_EMAIL: 'omar@example.com' }, LIVE) });
  post(env, lead());
  assert.equal(env.mails.length, 1);
  assert.equal(dataRows(env, 'Leads')[0][col(env, 'telegram')], 'sent+email');
});

test('busy lock or a sheet failure returns an error so the page shows its fallback', () => {
  assert.deepEqual(post(load({ props: LIVE, lockBusy: true }), lead()), { ok: false, error: 'busy' });
  assert.deepEqual(post(load({ props: LIVE, appendFail: true }), lead()), { ok: false, error: 'server' });
});

test('a retried submission (same sid) is stored once and gets the same reference', () => {
  const env = load({ props: LIVE });
  const l = lead({ sid: 'S-retry-1' });
  const a = post(env, l), b = post(env, l);
  assert.equal(a.ok, true); assert.equal(b.ref, a.ref); assert.equal(b.duplicate, true);
  assert.equal(dataRows(env, 'Leads').length, 1);
  assert.equal(env.fetches.length, 1);
});

/* ---------- 4. export to the Sales Hub ---------- */

test('export: one document per customer with a stable id (no duplicates on re-import)', () => {
  const env = load({ props: Object.assign({ EXPORT_KEY: KEY }, LIVE) });
  post(env, lead({ phone: '0500000092', company: 'Co A', tonnes: { d16: 10 } }));
  post(env, lead({ phone: '+966500000092', company: 'Co A', tonnes: { d20: 30 } }));   // same customer, other format
  post(env, lead({ phone: '0500000093', company: 'Co B' }));
  const first = get(env, { action: 'export', key: KEY }).leads;
  const again = get(env, { action: 'export', key: KEY }).leads;
  assert.equal(first.length, 2);
  assert.deepEqual(first.map(x => x.id), ['web-966500000092', 'web-966500000093']);
  assert.deepEqual(again.map(x => x.id), first.map(x => x.id));         // same ids every time
  const a = first[0];
  assert.equal(a.data.log.length, 2);                                   // both requests folded in
  assert.equal(a.match.phone, '+966500000092');
  assert.equal(a.data.review, true); assert.equal(a.data.by, 'website'); assert.equal(a.data.stage, 'طلب عرض سعر');
  // simulate an importer that upserts by id into the hub
  const hub = {}; [...first, ...again].forEach(d => { hub[d.id] = d.data; });
  assert.equal(Object.keys(hub).length, 2);
});

test('export never pushes anywhere by itself', () => {
  const env = load({ props: Object.assign({ EXPORT_KEY: KEY }, LIVE) });
  post(env, lead());
  const before = env.fetches.length;
  get(env, { action: 'export', key: KEY });
  assert.equal(env.fetches.length, before);
});

/* ---------- 5. TEST data never mixes with real data ---------- */

test('TEST_MODE (default) writes only to *_TEST sheets', () => {
  const env = load({ props: SECRET });                                   // TEST_MODE not set -> test
  post(env, lead());
  post(env, { kind: 'event', type: 'wa_click', page: '/x/' });
  assert.equal(env.sheets.Leads, undefined);
  assert.equal(env.sheets.Events, undefined);
  assert.equal(dataRows(env, 'Leads_TEST').length, 1);
  assert.equal(dataRows(env, 'Events_TEST').length, 1);
  assert.match(env.fetches[0].body.text, /^\[TEST\]/);
});

test('real mode writes only to real sheets; reports and export keep them apart', () => {
  const env = load({ props: Object.assign({ EXPORT_KEY: KEY }, SECRET) });
  post(env, lead({ company: 'Fake Co' }));                              // test mode
  env.props.TEST_MODE = 'false';
  post(env, lead({ company: 'Real Co' }));
  assert.equal(dataRows(env, 'Leads').length, 1);
  assert.equal(dataRows(env, 'Leads')[0][col(env, 'company')], 'Real Co');
  assert.equal(dataRows(env, 'Leads')[0][col(env, 'test')], '');
  const exp = get(env, { action: 'export', key: KEY }).leads;
  assert.deepEqual(exp.map(x => x.data.company), ['Real Co']);
  const report = env.ctx.buildReport();
  assert.equal(report.slice(2).reduce((s, r) => s + r[4], 0), 1);        // only the real lead counted
  assert.ok(env.sheets.Report && !env.sheets.Report_TEST);
});

test('seedDemoData always writes to the TEST sheets and restores the mode', () => {
  const env = load({ props: { TEST_MODE: 'false' } });
  const refs = env.ctx.seedDemoData();
  assert.equal(refs.length, 3);
  assert.equal(dataRows(env, 'Leads').length, 0);
  assert.equal(dataRows(env, 'Leads_TEST').length, 3);
  assert.equal(env.props.TEST_MODE, 'false');
  const env2 = load({ props: {} });
  env2.ctx.seedDemoData();
  assert.equal('TEST_MODE' in env2.props, false);                        // unset stays unset
});

/* ---------- features ---------- */

test('valid lead: scored A, alert has the essentials and no price', () => {
  const env = load({ props: LIVE });
  post(env, lead({ phone: '0500000001' }));
  const row = dataRows(env, 'Leads')[0];
  assert.equal(row[col(env, 'class')], 'A');
  assert.equal(row[col(env, 'phone')], "'+966500000001");                  // text in the sheet
  assert.equal(row[col(env, 'status')], 'طلب عرض سعر');
  const msg = env.fetches[0].body;
  assert.equal(msg.chat_id, '123');
  assert.match(msg.text, /Ø16: 60 ط · Ø20: 90 ط · Ø25: 80 ط — الإجمالي 230 طن/);
  assert.match(msg.text, /المصدر: linkedin \/ c01-bars-per-tonne/);
  assert.match(msg.text, /واتساب: https:\/\/wa\.me\/966500000001\n/);
  assert.match(msg.text, /لم يُرسل للعميل أي شيء تلقائياً/);
  assert.doesNotMatch(msg.text, /ريال|SAR|سعر الطن/);
});

test('scoring: B and C classes', () => {
  const env = load({ props: LIVE });
  assert.equal(env.ctx.score_({ total_t: 80, stage: 'comparing', tonnes: { d12: 80 }, grade: '80', needed_by: '', position: 'Engineer', city: 'جدة' }).cls, 'B');
  assert.equal(env.ctx.score_({ total_t: 5, stage: 'budget', tonnes: { d10: 5 }, grade: 'unsure', needed_by: '', position: '', city: 'القصيم' }).cls, 'C');
});

test('report per post: clicks, inquiries, quotations, wins, tonnes won', () => {
  const env = load({ props: LIVE });
  post(env, lead());
  post(env, lead({ tonnes: { d12: 10 }, stage: 'budget', utm_content: 'c02-weight-formula' }));
  post(env, { kind: 'event', type: 'wa_click', page: '/writing/x/', utm_source: 'linkedin', utm_campaign: 'series-1', utm_content: 'c01-bars-per-tonne' });
  const L = env.sheets.Leads.rows;
  L[1][col(env, 'status')] = 'فاز'; L[1][col(env, 'tons_won')] = 120; L[1][col(env, 'company_quote_no')] = 'Q-1';
  const out = env.ctx.buildReport();
  const c01 = out.find(r => r[2] === 'c01-bars-per-tonne');
  assert.deepEqual(c01.slice(3), [1, 1, 1, 0, 0, 230, 1, 1, 120]);
  assert.equal(out.indexOf(c01), 2);
});

test('daily digest goes to Omar only', () => {
  const env = load({ props: LIVE });
  post(env, lead());
  env.fetches.length = 0;
  assert.equal(env.ctx.dailyDigest(), 'sent');
  assert.equal(env.fetches.length, 1);
  assert.equal(env.fetches[0].body.chat_id, '123');
});

test('setup: both real and TEST sheets, dropdowns, Audit, two daily triggers', () => {
  const env = load({ props: {} });
  env.ctx.setup();
  ['Leads', 'Events', 'Leads_TEST', 'Events_TEST', 'Audit'].forEach(s => assert.ok(env.sheets[s], s));
  assert.equal(env.props.TEST_MODE, 'true');
  assert.deepEqual(env.triggers.map(t => [t.fn, t.h]).sort(), [['dailyDigest', 7], ['dailyJobs', 6]]);
});

/* ---------- 8/9. repository guards ---------- */

test('LEAD_ENDPOINT in the site is empty until Omar approves deployment', () => {
  const fs = require('fs'), path = require('path');
  const js = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'assets', 'quote.js'), 'utf8');
  assert.match(js, /var LEAD_ENDPOINT = '';/);
  assert.doesNotMatch(js, /script\.google\.com\/macros\/s\//);
});

test('no Telegram token or Apps Script deployment id in the automation files', () => {
  const fs = require('fs'), path = require('path');
  const dir = path.join(__dirname, '..');
  for (const f of ['Code.gs', 'appsscript.json']) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(t, /\d{8,10}:[A-Za-z0-9_-]{30,}/, f);           // Telegram bot token shape
    assert.doesNotMatch(t, /AKfycb[A-Za-z0-9_-]{20,}/, f);               // Apps Script deployment id shape
  }
});
