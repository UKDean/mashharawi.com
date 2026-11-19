/* Smart RFQ Generator: catalogue, validation, summaries, RFQ text, WhatsApp
   and email links, pages (languages, RTL, links, help), safety (no HTML
   insertion, no storage, no network, no form submission). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../assets/rfq/rfq.js');
const T = require('../assets/rfq/i18n.js');

const ROOT = path.join(__dirname, '..');
const TODAY = '2026-11-20';
const SITE = 'https://mashharawi.com';
const PAGES = { en: '/tools/smart-rfq-generator/', ar: '/ar/tools/smart-rfq-generator/', zh: '/zh/tools/smart-rfq-generator/' };
const HELP = { en: '/help/smart-rfq-generator/', ar: '/ar/help/smart-rfq-generator/', zh: '/zh/help/smart-rfq-generator/' };
const HL = { en: 'en', ar: 'ar', zh: 'zh-Hans' };
const read = u => fs.readFileSync(path.join(ROOT, u, 'index.html'), 'utf8');
const base = over => {
  const s = {
    customer: { company: 'ACME Contracting', contact: 'Ali', email: '', phone: '+966 50 123 4567', country: '', city: '' },
    project: { name: 'Tower A', location: 'Riyadh', site: '', date: '', schedule: 'single', notes: '' },
    lines: [{ type: 'standard', dia: '16', grade: '60', qty: '40', date: '', notes: '' }],
    payment: 'lc'
  };
  return over ? over(s) || s : s;
};
const codes = v => v.errors.map(e => e.path + ':' + e.code);

/* ---- catalogue ------------------------------------------------------------------ */
test('catalogue reflects the Al Rajhi Steel range', () => {
  assert.deepEqual(R.TYPES, ['standard', 'epoxy', 'cold8']);
  assert.deepEqual(R.PRODUCTS.standard.dias, [10, 12, 14, 16, 18, 20, 25, 32]);
  assert.deepEqual(R.PRODUCTS.standard.grades, ['60', '80']);
  assert.equal(T.en.length.standard, '12 m');
  assert.ok(!R.PRODUCTS.standard.dias.includes(22) && !R.PRODUCTS.epoxy.dias.includes(22), 'no 22 mm');
  assert.deepEqual(R.PRODUCTS.epoxy.dias, R.PRODUCTS.standard.dias);
  assert.equal(R.PRODUCTS.epoxy.confirm, true, 'epoxy availability must be confirmed');
  assert.deepEqual([R.PRODUCTS.cold8.dias, R.PRODUCTS.cold8.grades, R.PRODUCTS.cold8.fixed], [[8], ['40'], true]);
  assert.equal(T.en.length.cold8, '6 m');
  assert.ok(!R.PRODUCTS.standard.grades.includes('40') && !R.PRODUCTS.cold8.grades.includes('60'), '8 mm Grade 40 never mixed with 60/80');
  for (const l of ['en', 'ar', 'zh']) assert.doesNotMatch(JSON.stringify(T[l].type), /coil|plain|لفائف|أملس|盘条|光圆/i);
});

/* ---- validation ------------------------------------------------------------------- */
test('a complete RFQ is valid, including one below 30 t', () => {
  const v = R.validate(base(), TODAY);
  assert.deepEqual(v.errors, []);
  const small = R.validate(base(s => { s.lines[0].qty = '2'; }), TODAY);
  assert.equal(small.ok, true, 'no minimum quantity is enforced');
  assert.ok(small.warnings.some(w => w.code === 'below30'));
  assert.ok(!v.warnings.some(w => w.code === 'below30'));
});

test('missing required fields', () => {
  const v = R.validate({ customer: {}, project: {}, lines: [], payment: '' }, TODAY);
  assert.deepEqual(codes(v).sort(), ['customer.company:required', 'customer.contact:required', 'customer.phone:required', 'lines:noLines',
    'payment:payment', 'project.location:required', 'project.name:required', 'project.schedule:schedule'].sort());
  assert.deepEqual(codes(R.validate(base(s => { s.customer.company = '   '; }), TODAY)), ['customer.company:required'], 'blank is missing');
});

test('email and phone formats', () => {
  for (const e of ['ali@acme.sa', 'a.b+rfq@sub.example.com']) assert.ok(R.validEmail(e), e);
  for (const e of ['ali', 'ali@', '@acme.sa', 'ali@acme', 'a b@c.com', 'a@b.c', '<x>@y.com']) assert.ok(!R.validEmail(e), e);
  assert.deepEqual(codes(R.validate(base(s => { s.customer.email = 'ali@acme'; }), TODAY)), ['customer.email:email']);
  assert.deepEqual(codes(R.validate(base(s => { s.customer.email = ''; }), TODAY)), [], 'email is optional');
  for (const p of ['+966 50 123 4567', '0501234567', '(011) 465-0000', '+86 138 0013 8000']) assert.ok(R.validPhone(p), p);
  for (const p of ['12345', 'call me', '+966 50 123 4567 8901 234', '50+1234567', '٠٥٠١٢٣٤٥٦٧']) assert.ok(!R.validPhone(p), p);
});

test('quantities: positive tonnes with a dot, up to 3 decimals', () => {
  const q = v => R.parseQty(v);
  assert.equal(q('12.5').kg, 12500); assert.equal(q('25').kg, 25000); assert.equal(q('0.001').kg, 1); assert.equal(q(' 7 ').kg, 7000);
  assert.equal(q('').err, 'qtyMissing');
  assert.equal(q('0').err, 'qtyPositive'); assert.equal(q('0.000').err, 'qtyPositive'); assert.equal(q('-3').err, 'qtyPositive');
  for (const s of ['12,5', '1,000', 'abc', '1e3', '12.', '.5', '12.5 t', 'Infinity', 'NaN', '٥']) assert.equal(q(s).err, 'qtyFormat', s);
  assert.equal(q('0.0001').err, 'qtyDecimals');
  assert.equal(q('100000').kg, 100000000); assert.equal(q('100000.001').err, 'qtyMax');
  assert.deepEqual(codes(R.validate(base(s => { s.lines[0].qty = '-1'; }), TODAY)), ['lines.0.qty:qtyPositive']);
});

test('product, diameter and grade: chosen explicitly and only from the offer', () => {
  const one = line => codes(R.validate(base(s => { s.lines = [Object.assign({ type: 'standard', dia: '16', grade: '60', qty: '5' }, line)]; }), TODAY));
  assert.deepEqual(one({ type: '' }), ['lines.0.type:type']);
  assert.deepEqual(one({ dia: '' }), ['lines.0.dia:dia'], 'no diameter is assumed');
  assert.deepEqual(one({ grade: '' }), ['lines.0.grade:gradeE'], 'no grade is assumed');
  assert.deepEqual(one({ dia: '22' }), ['lines.0.dia:notOffered']);
  assert.deepEqual(one({ dia: '8' }), ['lines.0.dia:notOffered'], '8 mm only as the cold-rolled product');
  assert.deepEqual(one({ grade: '40' }), ['lines.0.grade:notOffered']);
  assert.deepEqual(one({ type: 'cold8', dia: '16', grade: '60' }), ['lines.0.dia:notOffered', 'lines.0.grade:notOffered']);
  assert.deepEqual(one({ type: 'cold8', dia: '8', grade: '40' }), []);
  assert.deepEqual(one({ type: 'coil' }), ['lines.0.type:type']);
  assert.deepEqual(one({ dia: '16.0' }), ['lines.0.dia:notOffered']);
  for (const d of R.PRODUCTS.standard.dias) for (const g of ['60', '80']) {
    assert.deepEqual(one({ dia: String(d), grade: g }), [], `${d} ${g}`);
    assert.deepEqual(one({ type: 'epoxy', dia: String(d), grade: g }), [], `epoxy ${d} ${g}`);
  }
});

test('dates, text length, line limit', () => {
  assert.deepEqual(codes(R.validate(base(s => { s.project.date = '2026-11-19'; }), TODAY)), ['project.date:past']);
  assert.deepEqual(codes(R.validate(base(s => { s.project.date = '2026-02-30'; }), TODAY)), ['project.date:date']);
  assert.deepEqual(codes(R.validate(base(s => { s.project.date = TODAY; s.lines[0].date = '2027-01-15'; }), TODAY)), []);
  assert.deepEqual(codes(R.validate(base(s => { s.lines[0].date = '2026-01-01'; }), TODAY)), ['lines.0.date:past']);
  assert.deepEqual(codes(R.validate(base(s => { s.customer.company = 'x'.repeat(121); }), TODAY)), ['customer.company:tooLong']);
  assert.deepEqual(codes(R.validate(base(s => { s.lines[0].notes = 'x'.repeat(201); }), TODAY)), ['lines.0.notes:tooLong']);
  const many = R.validate(base(s => { s.lines = Array.from({ length: 51 }, () => ({ type: 'standard', dia: '12', grade: '60', qty: '1' })); }), TODAY);
  assert.ok(codes(many).includes('lines:maxLines'));
});

test('duplicate lines are flagged, not merged; epoxy lines are flagged for confirmation', () => {
  const v = R.validate(base(s => {
    s.lines = [{ type: 'standard', dia: '16', grade: '60', qty: '10' }, { type: 'standard', dia: '16', grade: '60', qty: '5' },
      { type: 'standard', dia: '16', grade: '60', qty: '5', date: '2027-02-01' }, { type: 'epoxy', dia: '16', grade: '60', qty: '5' }];
  }), TODAY);
  assert.equal(v.ok, true);
  assert.deepEqual(v.warnings.filter(w => w.code === 'duplicate'), [{ code: 'duplicate', lines: [1, 2] }], 'different date or product is not a duplicate');
  assert.deepEqual(v.warnings.filter(w => w.code === 'epoxy'), [{ code: 'epoxy', lines: [4] }]);
  assert.equal(v.lines.length, 4);
});

test('summary: total on its own, breakdown never mixes types or grades, incomplete lines not counted', () => {
  const v = R.validate(base(s => {
    s.lines = [{ type: 'standard', dia: '16', grade: '60', qty: '25' }, { type: 'standard', dia: '12', grade: '60', qty: '8' },
      { type: 'cold8', dia: '8', grade: '40', qty: '2' }, { type: 'standard', dia: '16', grade: '80', qty: '1.5' },
      { type: 'epoxy', dia: '16', grade: '60', qty: '0.25' }, { type: 'standard', dia: '16', grade: '60', qty: '3.333' },
      { type: 'standard', dia: '', grade: '60', qty: '99' }];
  }), TODAY);
  const s = v.summary;
  assert.equal(s.lines, 7); assert.equal(s.validLines, 6); assert.equal(s.incomplete, 1);
  assert.equal(s.totalKg, 25000 + 8000 + 2000 + 1500 + 250 + 3333);
  assert.equal(R.fmtT(s.totalKg), '40.083');
  assert.deepEqual(s.breakdown.map(g => [g.type, g.dia, g.grade, g.kg]), [
    ['standard', 12, '60', 8000], ['standard', 16, '60', 28333], ['standard', 16, '80', 1500], ['epoxy', 16, '60', 250], ['cold8', 8, '40', 2000]]);
  assert.equal(R.fmtT(1234567), '1,234.567'); assert.equal(R.fmtT(25000), '25'); assert.equal(R.fmtT(12500), '12.5');
});

test('worked example in the guides matches the engine', () => {
  const v = R.validate(base(s => {
    s.lines = [{ type: 'standard', dia: '16', grade: '60', qty: '25' }, { type: 'standard', dia: '12', grade: '60', qty: '8' }, { type: 'cold8', dia: '8', grade: '40', qty: '2' }];
  }), TODAY);
  assert.equal(R.fmtT(v.summary.totalKg), '35');
  assert.deepEqual(v.summary.breakdown.map(g => [g.dia, R.fmtT(g.kg)]), [[12, '8'], [16, '25'], [8, '2']]);
  for (const l of Object.keys(HELP)) {
    const g = read(HELP[l]);
    for (const id of ['customer', 'project', 'products', 'commercial', 'review', 'export', 'privacy']) assert.ok(g.includes(`id="${id}"`), `${l} #${id}`);
    assert.match(g, l === 'en' ? /35 t \(all products\)/ : l === 'ar' ? /35 طناً/ : /35 吨/);
  }
});

/* ---- RFQ text and links ---------------------------------------------------------- */
test('RFQ text: page language, all data, reference, disclaimer, no prices', () => {
  const st = base(s => {
    s.customer.email = 'ali@acme.sa'; s.project.site = 'Plot 5'; s.project.date = '2026-12-15'; s.project.notes = 'Gate 3';
    s.lines = [{ type: 'standard', dia: '16', grade: '60', qty: '12.5', notes: 'columns' }, { type: 'epoxy', dia: '20', grade: '80', qty: '5', date: '2027-01-10' }, { type: 'cold8', dia: '8', grade: '40', qty: '2' }];
  });
  const v = R.validate(st, TODAY);
  const ref = R.makeRef(TODAY, [0, 1, 2, 3, 31]);
  assert.equal(ref, 'RFQ-20261120-ABCD9');
  assert.match(R.makeRef(TODAY, [255, 255, 255, 255, 255]), /^RFQ-20261120-[A-Z2-9]{5}$/);
  for (const l of ['en', 'ar', 'zh']) {
    const t = R.buildText(st, v, T[l], ref, TODAY);
    for (const x of [ref, TODAY, 'ACME Contracting', 'Ali', '+966 50 123 4567', 'ali@acme.sa', 'Tower A', 'Riyadh', 'Plot 5', '2026-12-15', 'Gate 3', 'columns', '2027-01-10',
      T[l].type.standard, T[l].type.epoxy, T[l].type.cold8, T[l].grade['60'], T[l].grade['80'], T[l].grade['40'], T[l].pv.confirm,
      T[l].payment.lc, T[l].schedule.single, T[l].paymentNote, T[l].transportNote, T[l].disclaimer, T[l].pv.refNote]) assert.ok(t.includes(x), `${l}: ${x}`);
    assert.ok(t.includes('19.5 ' + T[l].unit), l + ' total');
    assert.doesNotMatch(t, /SAR|SR\b|ريال|price:|السعر:|价格：|\$|USD/, l + ' no price');
  }
  assert.throws(() => R.buildText(base(s => { s.lines[0].qty = '0'; }), R.validate(base(s => { s.lines[0].qty = '0'; }), TODAY), T.en, ref, TODAY), /valid RFQ/);
});

test('disclaimer and commercial notes: exact English text, translated in Arabic and Chinese', () => {
  assert.equal(T.en.disclaimer, 'This document is a request for quotation only. It is not a price offer, purchase order, sales contract, or confirmation of product availability. Final prices, specifications, payment terms, and delivery schedules are subject to confirmation by Al Rajhi Steel.');
  assert.equal(T.en.paymentNote, 'Final payment terms and product availability are subject to confirmation by the Al Rajhi Steel sales team.');
  assert.equal(T.en.transportNote, 'Full truckload requirements and additional transportation costs for quantities below 30 metric tons may apply. Please confirm with the sales team.');
  assert.match(T.ar.disclaimer, /طلب عرض سعر فقط/); assert.match(T.ar.disclaimer, /أمر شراء/); assert.match(T.ar.disclaimer, /عقد بيع/); assert.match(T.ar.disclaimer, /الراجحي للحديد/);
  assert.match(T.zh.disclaimer, /询价请求/); assert.match(T.zh.disclaimer, /采购订单/); assert.match(T.zh.disclaimer, /销售合同/); assert.match(T.zh.disclaimer, /Al Rajhi Steel/);
  for (const l of ['ar', 'zh']) assert.doesNotMatch(T[l].disclaimer + T[l].paymentNote + T[l].transportNote, /\b(the|and|subject|price)\b/i);
  // the same keys in every language
  const shape = o => Object.keys(o).sort().map(k => k + (o[k] && typeof o[k] === 'object' ? '{' + shape(o[k]) + '}' : '')).join(',');
  assert.equal(shape(T.ar), shape(T.en)); assert.equal(shape(T.zh), shape(T.en));
});

test('WhatsApp and email links are encoded and never send by themselves', () => {
  const text = 'RFQ & test #1\nسطر عربي\n中文 + 50% ?=';
  const wa = R.waUrl(text);
  assert.ok(wa.startsWith('https://wa.me/' + R.CONTACT.whatsapp + '?text='));
  const q = wa.split('?text=')[1];
  assert.doesNotMatch(q, /[\s&#?+]/, 'everything reserved is encoded');
  assert.equal(decodeURIComponent(q), text);
  assert.equal(R.waUrl('x'.repeat(R.WA_TEXT_MAX + 1)), null);
  assert.ok(R.waUrl('ع'.repeat(R.WA_TEXT_MAX)), 'the limit is on text, so Arabic is not penalised');
  const m = R.mailtoUrl('RFQ RFQ-1: steel & mesh', 'line 1\nline 2 & more');
  assert.ok(m.startsWith('mailto:' + R.CONTACT.email + '?subject='));
  const qs = new URLSearchParams(m.split('?')[1].replace(/\+/g, '%2B'));
  assert.equal(qs.get('subject'), 'RFQ RFQ-1: steel & mesh');
  assert.equal(qs.get('body'), 'line 1\r\nline 2 & more');
  assert.doesNotMatch(m.split('?')[1], / /);
  assert.equal(R.mailtoUrl('s', 'x'.repeat(5000)), null);
  assert.ok(R.shortMailto('s', 'paste').length < 200);
});

/* ---- pages -------------------------------------------------------------------------- */
test('three pages: language, RTL, canonical, reciprocal hreflang, equivalent switches, help links', () => {
  for (const [l, u] of Object.entries(PAGES)) {
    const h = read(u);
    assert.match(h, new RegExp(`<html lang="${HL[l]}" dir="${l === 'ar' ? 'rtl' : 'ltr'}">`));
    assert.ok(h.includes(`<link rel="canonical" href="${SITE + u}">`));
    const alts = Object.fromEntries([...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => [m[1], m[2]]));
    assert.deepEqual(alts, { en: SITE + PAGES.en, ar: SITE + PAGES.ar, 'zh-Hans': SITE + PAGES.zh, 'x-default': SITE + PAGES.en });
    for (const o of Object.keys(PAGES)) if (o !== l) assert.ok(h.includes(`href="${PAGES[o]}" hreflang="${HL[o]}"`), `${l} -> ${o}`);
    for (const b of h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(b.replace(/<\/?script[^>]*>/g, ''));
    const desc = h.match(/<meta name="description" content="([^"]+)">/)[1];
    assert.ok(desc.length >= (l === 'zh' ? 30 : 60) && desc.length <= 200, l + ' description ' + desc.length);
    assert.ok(h.includes(`<p class="cd-help r-no-print"><a href="${HELP[l]}" target="_blank" rel="noopener">`));
    const g = read(HELP[l]);
    const ctx = [...h.matchAll(/<a class="cd-q" href="([^"#]+)#([^"]+)" target="_blank" rel="noopener">/g)];
    assert.equal(ctx.length, 5);
    for (const [, gu, a] of ctx) { assert.equal(gu, HELP[l]); assert.ok(g.includes(`id="${a}"`), `${l} #${a}`); }
    for (const [, href] of h.matchAll(/href="(\/[^"#]*)(?:#[^"]*)?"/g)) {
      if (/^\/(assets|favicon|apple-touch)/.test(href)) continue;
      assert.ok(fs.existsSync(path.join(ROOT, href, href.endsWith('/') ? 'index.html' : '')), `${l} -> ${href}`);
    }
    assert.ok(h.includes(T[l].paymentNote.replace(/'/g, '&#x27;')) && h.includes(T[l].transportNote.replace(/'/g, '&#x27;')), l + ' commercial notes on the page');
    for (const d of [10, 12, 14, 16, 18, 20, 25, 32]) assert.ok(h.includes(String(d)), d);
    assert.doesNotMatch(h, /\b22 ?mm|22 مم|22 毫米/);
  }
  assert.ok(read('/tools/').includes('href="/tools/smart-rfq-generator/"'));
  assert.ok(read('/ar/tools/').includes('href="/ar/tools/smart-rfq-generator/"'));
  assert.ok(read('/zh/').includes('href="/zh/tools/smart-rfq-generator/"'));
  for (const [l, u] of Object.entries({ en: '/help/', ar: '/ar/help/', zh: '/zh/help/' })) assert.ok(read(u).includes(`href="${HELP[l]}"`), l + ' help index');
});

test('privacy and safety: no storage, no network, no form submission, no HTML insertion', () => {
  const app = fs.readFileSync(path.join(ROOT, 'assets/rfq/app.js'), 'utf8');
  const eng = fs.readFileSync(path.join(ROOT, 'assets/rfq/rfq.js'), 'utf8');
  for (const [n, src] of [['app.js', app], ['rfq.js', eng]]) {
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|setAttribute\(['"]on/, n + ' writes no HTML');
    assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|document\.cookie|caches\.|\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|navigator\.share/, n + ' no storage or network');
  }
  assert.ok(app.includes("addEventListener('pageshow'"), 'a page restored from the back/forward cache is cleared');
  // the only places customer data can leave: the two links the user opens
  assert.equal((app.match(/window\.open\(/g) || []).length, 1);
  assert.equal((app.match(/window\.location\.href = /g) || []).length, 2);
  assert.ok(/\$\('rWa'\)\.addEventListener\('click', function \(\) \{\s*if \(!ready\(true\)\) return;/.test(app), 'WhatsApp needs the review tick');
  assert.ok(/\$\('rMail'\)\.addEventListener\('click', function \(\) \{\s*if \(!ready\(true\)\) return;/.test(app), 'email needs the review tick');
  for (const u of Object.values(PAGES)) {
    const h = read(u);
    assert.doesNotMatch(h, /<form\b/, 'no form element, so nothing can be submitted');
    for (const [tag] of h.matchAll(/<(?:input|textarea|select)\b[^>]*>/g)) {
      if (/type="(radio|checkbox)"/.test(tag) && !/autocomplete="off"/.test(tag)) assert.fail('autocomplete: ' + tag);
      if (!/type="(radio|checkbox)"/.test(tag)) assert.match(tag, /autocomplete="off"/, tag);
      if (/type="radio"/.test(tag)) continue;
      assert.doesNotMatch(tag, /\bname=/, 'no names: no field could be sent by a form ' + tag);
    }
    assert.deepEqual([...h.matchAll(/<script src="([^"]+)"/g)].map(m => m[1].split('?')[0]), ['/assets/site.js', '/assets/rfq/i18n.js', '/assets/rfq/rfq.js', '/assets/rfq/app.js']);
    assert.doesNotMatch(h, /googletagmanager|gtag\(|analytics|facebook\.net|hotjar|clarity\.ms/i);
    assert.doesNotMatch(h, /speculationrules/, 'no prefetching from a page with personal data');
  }
  const css = fs.readFileSync(path.join(ROOT, 'assets/rfq/rfq.css'), 'utf8');
  assert.match(css, /@media print\{[\s\S]*\.r-no-print[^}]*display:none!important/);
  assert.match(css, /@media print\{[\s\S]*\.c-header,\.c-footer/);
});

/* ---- long RFQs: WhatsApp and email fallbacks ---------------------------------------- */
const longRfq = n => base(s => {
  s.customer = { company: 'شركة المقاولات المتحدة', contact: 'علي حسن', phone: '+966 50 123 4567', email: 'ali@acme.sa', country: 'السعودية', city: 'الرياض' };
  s.project = { name: 'برج الأعمال', location: 'الرياض', site: 'حي الملقا', date: '2026-12-20', schedule: 'multiple', notes: '' };
  s.lines = Array.from({ length: n }, (_, i) => ({ type: ['standard', 'epoxy', 'cold8'][i % 3], dia: ['16', '20', '8'][i % 3], grade: ['60', '80', '40'][i % 3],
    qty: String(5 + i), date: '2027-01-' + String(10 + (i % 18)).padStart(2, '0'), notes: 'ملاحظة للبند ' + (i + 1) }));
});

test('long Arabic and Chinese RFQs: never a cut WhatsApp message, email falls back to copy', () => {
  for (const [l, n] of [['ar', 30], ['ar', 50], ['zh', 50]]) {
    const st = longRfq(n), v = R.validate(st, TODAY);
    assert.equal(v.ok, true);
    const t = R.buildText(st, v, T[l], 'RFQ-20261120-ABCDE', TODAY);
    assert.ok(t.length > R.WA_TEXT_MAX, `${l} ${n} lines: ${t.length} characters`);
    assert.equal(R.waUrl(t), null, 'no WhatsApp link for a text over the limit');
    assert.equal(R.mailtoUrl(T[l].subject('RFQ-20261120-ABCDE', st.project.name), t), null);
    assert.ok(t.endsWith(T[l].disclaimer), 'the complete text, with the disclaimer, is what gets copied');
    assert.match(T[l].waLong(t.length, R.WA_TEXT_MAX), new RegExp(t.length.toLocaleString('en').replace(',', ',')));
  }
  for (const [l, n] of [['ar', 10], ['zh', 30]]) {
    const st = longRfq(n), v = R.validate(st, TODAY), t = R.buildText(st, v, T[l], 'RFQ-1', TODAY);
    assert.ok(t.length <= R.WA_TEXT_MAX && R.waUrl(t), `${l} ${n} lines fits WhatsApp`);
    assert.equal(decodeURIComponent(R.waUrl(t).split('?text=')[1]), t, 'the whole text, not a part');
  }
  for (const l of ['en', 'ar', 'zh']) {
    assert.ok(T[l].mailBody('RFQ-1').includes('RFQ-1'));
    assert.ok(R.shortMailto('s', T[l].mailBody('RFQ-1')).length < R.MAIL_MAX);
    assert.match(T[l].waCount(4842, 4000), /4,842/);
    assert.ok(T[l].copySelect && T[l].mailLong);
  }
  const app = fs.readFileSync(path.join(ROOT, 'assets/rfq/app.js'), 'utf8');
  const wa = app.slice(app.indexOf("$('rWa').addEventListener"), app.indexOf("$('rMail').addEventListener"));
  const tooLong = wa.slice(wa.indexOf('if (!url) {'), wa.indexOf('return;\n    }') + 7);
  assert.ok(tooLong.includes('copyText(text') && !tooLong.includes('window.open'), 'too long: copy, never open WhatsApp');
  const mail = app.slice(app.indexOf("$('rMail').addEventListener"), app.indexOf('/* ---- clear'));
  const fb = mail.slice(mail.indexOf('copyText(text, function (ok) {'));
  assert.ok(fb.indexOf("if (!ok) { say(T.copySelect); return; }") >= 0 && fb.indexOf("if (!ok)") < fb.indexOf('window.location.href'), 'email opens only after a successful copy');
  assert.match(app, /function say\(t\) \{ msg\.textContent = t; \}/, 'instructions are not cleared by a timer');
});

test('privacy wording: the RFQ text leaves when WhatsApp or email is opened, not only on Send', () => {
  const old = /leave the browser only|leaves only when you send|nothing is sent until you press send|لا يخرج الطلب إلا|لا تخرج بياناتك من المتصفح إلا|لا يُرسل شيء حتى تضغط إرسال|只有您从自己的 WhatsApp 或邮箱发送时|才会离开浏览器|在您按下发送之前，不会发送任何内容/i;
  const want = { en: [/is passed to your email application/, /even before you press Send/, /clipboard/], ar: [/يُمرَّر نص الطلب/, /حتى قبل أن تضغط «إرسال»/, /حافظة/],
    zh: [/传给/, /即使您尚未按下发送/, /剪贴板/] };
  for (const l of Object.keys(PAGES)) {
    const tool = read(PAGES[l]), guide = read(HELP[l]);
    assert.doesNotMatch(tool + guide, old, l);
    const priv = guide.slice(guide.indexOf('id="privacy"'), guide.indexOf('id="mistakes"'));
    for (const re of want[l]) assert.match(priv, re, `${l} guide privacy ${re}`);
    assert.match(tool, l === 'en' ? /the RFQ text is passed to that application/ : l === 'ar' ? /يُمرَّر نص الطلب إلى ذلك التطبيق/ : /询价文本会传给该应用/);
    assert.ok(guide.includes('4,000'), l + ' guide states the WhatsApp limit');
  }
});
