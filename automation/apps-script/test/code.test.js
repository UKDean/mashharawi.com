// node --test automation/apps-script/test
const test = require('node:test'), assert = require('node:assert');
const { load, post } = require('./harness');

const SECRET = { TELEGRAM_BOT_TOKEN: 'TEST_TOKEN_NOT_REAL', TELEGRAM_CHAT_ID: '123' };
function lead(over = {}) {
  return Object.assign({
    kind: 'lead', name: 'عميل تجريبي', company: 'شركة تجريبية', position: 'مدير المشتريات', phone: '+966500000001',
    email: 'demo@example.com', project: 'برج تجريبي', city: 'الرياض', tonnes: { d16: 60, d20: 90, d25: 80 }, total_t: 230,
    grade: '60', cutting: true, epoxy: false, needed_by: '', stage: 'ready', notes: '', consent: true, elapsed_ms: 15000,
    utm_source: 'linkedin', utm_campaign: 'series-1', utm_content: 'c01-bars-per-tonne', first_landing: '/writing/bars-per-tonne/',
    page: '/ar/quote/', lang: 'ar', from_calculator: true
  }, over);
}
const col = (env, key) => env.ctx.LEAD_COLS.findIndex(c => c[0] === key);

test('valid lead is stored, scored A, and Omar gets one Telegram alert', () => {
  const env = load({ props: SECRET });
  const r = post(env, lead());
  assert.equal(r.ok, true);
  assert.match(r.ref, /^L-\d{6}-\d{4}$/);
  const rows = env.sheets.Leads.rows;
  assert.equal(rows.length, 2);                                   // header + 1
  const row = rows[1];
  assert.equal(row[col(env, 'class')], 'A');
  assert.equal(row[col(env, 'total_t')], 230);
  assert.equal(row[col(env, 'd25')], 80);
  assert.equal(row[col(env, 'utm_content')], 'c01-bars-per-tonne');
  assert.equal(row[col(env, 'status')], 'طلب عرض سعر');
  assert.equal(row[col(env, 'test')], 'TEST');                  // TEST_MODE defaults to on
  assert.equal(row[col(env, 'telegram')], 'sent');
  assert.equal(env.fetches.length, 1);
  const msg = env.fetches[0].body;
  assert.equal(msg.chat_id, '123');
  assert.match(env.fetches[0].url, /api\.telegram\.org\/botTEST_TOKEN_NOT_REAL\/sendMessage$/);
  assert.match(msg.text, /^\[TEST\] <b>طلب عرض سعر جديد — A/);
  assert.match(msg.text, /Ø16: 60 ط · Ø20: 90 ط · Ø25: 80 ط — الإجمالي 230 طن/);
  assert.match(msg.text, /المصدر: linkedin \/ c01-bars-per-tonne/);
  assert.match(msg.text, /لم يُرسل للعميل أي شيء تلقائياً/);
  assert.doesNotMatch(msg.text, /ريال|SAR|سعر الطن/);              // never a price
  assert.match(msg.text, /واتساب: https:\/\/wa\.me\/966500000001\n/);    // clickable, no sheet escaping
  assert.doesNotMatch(msg.text, /'\+/);
  assert.equal(row[col(env, 'phone')], "'+966500000001");          // stored as text in the sheet
});

test('scoring: B and C classes', () => {
  const env = load({ props: SECRET });
  const b = env.ctx.score_({ total_t: 80, stage: 'comparing', tonnes: { d12: 80 }, grade: '80', needed_by: '', position: 'Engineer', city: 'جدة' });
  assert.equal(b.cls, 'B');
  const c = env.ctx.score_({ total_t: 5, stage: 'budget', tonnes: { d10: 5 }, grade: 'unsure', needed_by: '', position: '', city: 'القصيم' });
  assert.equal(c.cls, 'C');
});

test('rejects bad input and stores nothing', () => {
  const env = load({ props: SECRET });
  assert.deepEqual(post(env, lead({ phone: '12' })), { ok: false, error: 'phone' });
  assert.deepEqual(post(env, lead({ consent: false })), { ok: false, error: 'no_consent' });
  assert.deepEqual(post(env, lead({ tonnes: { d22: 5 } })), { ok: false, error: 'diameter' });
  assert.deepEqual(post(env, lead({ tonnes: {} })), { ok: false, error: 'quantity' });
  assert.deepEqual(post(env, lead({ elapsed_ms: 900 })), { ok: false, error: 'too_fast' });
  assert.deepEqual(post(env, lead({ company: '' })), { ok: false, error: 'missing' });
  assert.equal(env.sheets.Leads, undefined);
  assert.equal(env.fetches.length, 0);
});

test('honeypot: bot gets ok but nothing is stored or sent', () => {
  const env = load({ props: SECRET });
  assert.equal(post(env, lead({ website: 'http://spam' })).ok, true);
  assert.equal(env.sheets.Leads, undefined);
  assert.equal(env.fetches.length, 0);
});

test('formula injection is neutralised', () => {
  const env = load({ props: SECRET });
  post(env, lead({ company: '=HYPERLINK("http://x","y")' }));
  assert.equal(env.sheets.Leads.rows[1][col(env, 'company')].startsWith("'="), true);
});

test('rate limit: 4th request from the same phone within 10 minutes is refused', () => {
  const env = load({ props: SECRET });
  for (let i = 0; i < 3; i++) assert.equal(post(env, lead()).ok, true);
  assert.deepEqual(post(env, lead()), { ok: false, error: 'rate' });
});

test('Telegram failure never loses the lead', () => {
  const env = load({ props: SECRET, telegramCode: 'throw' });
  const r = post(env, lead());
  assert.equal(r.ok, true);
  assert.equal(env.sheets.Leads.rows[1][col(env, 'telegram')], 'telegram-exception');
});

test('without Telegram settings the lead is still saved', () => {
  const env = load({ props: {} });
  assert.equal(post(env, lead()).ok, true);
  assert.equal(env.sheets.Leads.rows[1][col(env, 'telegram')], 'no-telegram-config');
});

test('TEST_MODE=false removes the TEST mark', () => {
  const env = load({ props: Object.assign({ TEST_MODE: 'false' }, SECRET) });
  post(env, lead());
  assert.equal(env.sheets.Leads.rows[1][col(env, 'test')], '');
  assert.doesNotMatch(env.fetches[0].body.text, /\[TEST\]/);
});

test('WhatsApp click events are counted; other event types refused', () => {
  const env = load({ props: SECRET });
  assert.equal(post(env, { kind: 'event', type: 'wa_click', where: 'floating', page: '/rebar/', utm_source: 'linkedin', utm_content: 'c01' }).ok, true);
  assert.equal(post(env, { kind: 'event', type: 'pageview' }).ok, false);
  assert.equal(env.sheets.Events.rows.length, 2);
  assert.equal(env.fetches.length, 0);                          // clicks never alert
});

test('report groups inquiries, clicks and sales per post', () => {
  const env = load({ props: SECRET });
  post(env, lead());
  post(env, lead({ phone: '+966500000002', tonnes: { d12: 10 }, stage: 'budget', utm_content: 'c02-weight-formula' }));
  post(env, { kind: 'event', type: 'wa_click', page: '/writing/x/', utm_source: 'linkedin', utm_campaign: 'series-1', utm_content: 'c01-bars-per-tonne' });
  // Omar marks the first lead won, 120 t
  const L = env.sheets.Leads.rows;
  L[1][col(env, 'status')] = 'فاز'; L[1][col(env, 'tons_won')] = 120; L[1][col(env, 'company_quote_no')] = 'Q-1';
  const out = env.ctx.buildReport();
  const c01 = out.find(r => r[2] === 'c01-bars-per-tonne');
  assert.deepEqual(c01.slice(3), [1, 1, 1, 0, 0, 230, 1, 1, 120]);
  const c02 = out.find(r => r[2] === 'c02-weight-formula');
  assert.equal(c02[4], 1);
  assert.equal(out.indexOf(c01) < out.indexOf(c02), true);       // sorted by tonnes won
});

test('daily digest lists due follow-ups and only goes to Omar', () => {
  const env = load({ props: SECRET });
  post(env, lead());                                              // class A -> follow-up today
  env.fetches.length = 0;
  assert.equal(env.ctx.dailyDigest(), 'sent');
  assert.equal(env.fetches.length, 1);
  assert.equal(env.fetches[0].body.chat_id, '123');
  assert.match(env.fetches[0].body.text, /متابعات اليوم/);
});

test('export for the Sales Hub needs the key and maps to the hub lead shape', () => {
  const env = load({ props: Object.assign({ EXPORT_KEY: 'k-123' }, SECRET) });
  post(env, lead());
  const bad = JSON.parse(env.ctx.doGet({ parameter: { action: 'export', key: 'wrong' } }).text);
  assert.deepEqual(bad, { ok: false, error: 'forbidden' });
  const res = JSON.parse(env.ctx.doGet({ parameter: { action: 'export', key: 'k-123' } }).text);
  assert.equal(res.leads.length, 1);
  const d = res.leads[0].data;
  assert.equal(d.tier, 'A'); assert.equal(d.stage, 'طلب عرض سعر'); assert.equal(d.review, true);
  assert.equal(d.by, 'website'); assert.match(d.source, /linkedin \/ c01-bars-per-tonne/);
  assert.equal(d.owner.status, 'لم يُفحص');
});

test('setup creates sheets, dropdowns and the two daily triggers', () => {
  const env = load({ props: {} });
  env.ctx.setup();
  assert.ok(env.sheets.Leads && env.sheets.Events);
  assert.equal(env.props.TEST_MODE, 'true');
  assert.deepEqual(env.triggers.map(t => [t.fn, t.h]).sort(), [['buildReport', 6], ['dailyDigest', 7]]);
  assert.equal(env.sheets.Leads.validations.length, 3);
});

test('demo data is fake and marked TEST', () => {
  const env = load({ props: { TEST_MODE: 'false' } });
  const refs = env.ctx.seedDemoData();
  assert.equal(refs.length, 3);
  env.sheets.Leads.rows.slice(1).forEach(r => assert.equal(r[col(env, 'test')], 'TEST'));
  assert.equal(env.props.TEST_MODE, 'false');                   // restored
});
