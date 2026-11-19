/* Tests for the Help Center pages (help/, ar/help/, zh/help/) and the Help
   links inside the tools. Static checks on the built HTML: languages, RTL,
   canonical and hreflang, structure, anchors, internal links, and that the
   numbers quoted in the guides are the numbers the tools produce. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const CutOpt = require('../assets/cutopt/engine.js');
const BBS = require('../assets/bbs/engine.js');
const BBST = require('../assets/bbs/i18n.js');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://mashharawi.com';
const PREFIX = { en: '/help/', ar: '/ar/help/', zh: '/zh/help/' };
const SLUGS = ['', 'cutting-optimizer/', 'bbs-analyzer/', 'steel-weight-verification/'];
const LANG = { en: ['en', 'ltr'], ar: ['ar', 'rtl'], zh: ['zh-Hans', 'ltr'] };
const read = (url) => fs.readFileSync(path.join(ROOT, url, 'index.html'), 'utf8');
const main = (html) => (html.match(/<main[\s\S]*?<\/main>/) || [''])[0];
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ');
// The weight verification tool is in PR #15; until that is merged its tool
// pages are not in this branch. Links to them are expected and listed here.
const PENDING = new Set(['/tools/steel-weight-verification/', '/ar/tools/steel-weight-verification/', '/zh/steel-weight-verification/']);

const pages = [];
for (const l of Object.keys(PREFIX)) for (const s of SLUGS) pages.push({ l, s, url: PREFIX[l] + s });

test('all 12 pages exist with the right language, direction and canonical URL', () => {
  assert.equal(pages.length, 12);
  for (const p of pages) {
    const h = read(p.url);
    assert.match(h, new RegExp(`<html lang="${LANG[p.l][0]}" dir="${LANG[p.l][1]}">`), p.url);
    assert.ok(h.includes(`<link rel="canonical" href="${SITE + p.url}">`), p.url);
    assert.ok(h.includes(`<meta property="og:url" content="${SITE + p.url}">`), p.url);
    assert.equal((h.match(/<title>/g) || []).length, 1);
    const desc = (h.match(/<meta name="description" content="([^"]*)">/) || [])[1] || '';
    assert.ok(desc.length >= (p.l === 'zh' ? 30 : 60) && desc.length <= 200, p.url + ' description length ' + desc.length);   // Chinese is denser
    for (const b of h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(b.replace(/<\/?script[^>]*>/g, ''));
  }
});

test('hreflang: the same reciprocal set on every equivalent page, x-default English', () => {
  for (const s of SLUGS) {
    const sets = Object.keys(PREFIX).map(l => {
      const h = read(PREFIX[l] + s);
      return Object.fromEntries([...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => [m[1], m[2]]));
    });
    const want = { en: SITE + PREFIX.en + s, ar: SITE + PREFIX.ar + s, 'zh-Hans': SITE + PREFIX.zh + s, 'x-default': SITE + PREFIX.en + s };
    sets.forEach(x => assert.deepEqual(x, want, s));
  }
});

test('language switch in the header keeps you on the equivalent page', () => {
  for (const p of pages) {
    const h = read(p.url);
    const others = Object.keys(PREFIX).filter(l => l !== p.l);
    for (const o of others) assert.ok(h.includes(`href="${PREFIX[o] + p.s}" hreflang="${LANG[o][0]}"`), `${p.url} -> ${o}`);
  }
});

test('no mixed languages: headings, navigation and body follow the page language', () => {
  const AR = /[\u0600-\u06FF]/, CJK = /[\u4e00-\u9fff]/;
  for (const p of pages) {
    const m = main(read(p.url));
    const heads = [...m.matchAll(/<(h1|h2|h3|summary|th)[^>]*>([\s\S]*?)<\/\1>/g)].map(x => text(x[2]).trim()).filter(Boolean);
    for (const hd of heads) {
      if (/^[\d\s.×Ø%()\-–kgm/]+$|^(kg\/m|Ø mm|Gr60|BBS|MTC|RebarPlan)$/.test(hd)) continue;   // numbers and units
      if (p.l === 'ar') assert.match(hd, AR, `${p.url}: "${hd}"`);
      if (p.l === 'zh') assert.match(hd, CJK, `${p.url}: "${hd}"`);
      if (p.l === 'en') { assert.doesNotMatch(hd, AR, `${p.url}: "${hd}"`); assert.doesNotMatch(hd, CJK, `${p.url}: "${hd}"`); }
    }
    const body = text(m);
    if (p.l === 'en') { assert.ok((body.match(/[\u0600-\u06FF]/g) || []).length < 40, p.url); assert.ok((body.match(/[\u4e00-\u9fff]/g) || []).length < 20, p.url); }
    if (p.l === 'ar') { assert.ok((body.match(/[\u0600-\u06FF]/g) || []).length > 1500, p.url); assert.ok((body.match(/[\u4e00-\u9fff]/g) || []).length < 20, p.url); }
    if (p.l === 'zh') { assert.ok((body.match(/[\u4e00-\u9fff]/g) || []).length > 800, p.url); assert.ok((body.match(/[\u0600-\u06FF]/g) || []).length < 40, p.url); }
    // no English sentences on the Arabic and Chinese pages (product names and units are allowed)
    if (p.l !== 'en') assert.doesNotMatch(body, /\b(the|and|with|from|this|that|your|which)\s+(the|a|an|is|are|tool|bars?|cut|length|weight)\b/i, p.url);
  }
});

test('the index has the seven sections; every guide has the teaching sections', () => {
  for (const l of Object.keys(PREFIX)) {
    const ix = read(PREFIX[l]);
    for (const id of ['getting-started', 'tool-guides', 'tutorials', 'examples', 'formulas', 'faq', 'troubleshooting']) assert.ok(ix.includes(`<h2 id="${id}">`), `${l} index #${id}`);
    for (const s of SLUGS.slice(1)) {
      const g = read(PREFIX[l] + s);
      for (const id of ['what', 'when', 'steps', 'example', 'results', 'mistakes', 'limits', 'related']) assert.ok(g.includes(` id="${id}"`), `${l} ${s} #${id}`);
      assert.ok(g.includes('class="h-ex"'), `${l} ${s} worked example box`);
    }
    assert.ok(read(PREFIX[l] + 'bbs-analyzer/').includes('id="twelve-metres"'));
    assert.ok(read(PREFIX[l] + 'bbs-analyzer/').includes('id="grades"'));
    assert.ok(read(PREFIX[l] + 'steel-weight-verification/').includes('id="compliance"'));
  }
});

test('every internal link and anchor in the help pages resolves', () => {
  const missing = [], pendingSeen = new Set();
  for (const p of pages) {
    const h = read(p.url);
    for (const [, href] of h.matchAll(/href="(\/[^"]*)"/g)) {
      if (/^\/(assets|favicon|apple-touch)/.test(href)) continue;
      const [u, frag] = href.split('#');
      if (PENDING.has(u)) { pendingSeen.add(u); continue; }
      const file = path.join(ROOT, u, u.endsWith('/') ? 'index.html' : '');
      if (!fs.existsSync(file)) { missing.push(p.url + ' -> ' + href); continue; }
      if (frag) { const t = fs.readFileSync(fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file, 'utf8'); if (!t.includes(`id="${frag}"`)) missing.push(p.url + ' -> ' + href + ' (anchor)'); }
    }
    for (const [, frag] of h.matchAll(/href="#([^"]+)"/g)) if (!h.includes(`id="${frag}"`)) missing.push(p.url + ' -> #' + frag);
  }
  assert.deepEqual(missing, []);
  assert.deepEqual([...pendingSeen].sort(), [...PENDING].sort());   // only the PR #15 tool URLs are pending
});

test('Help links inside the tools: right language, new tab, existing anchors', () => {
  const tools = [
    ['tools/cutting-optimizer', '/help/cutting-optimizer/'], ['ar/tools/cutting-optimizer', '/ar/help/cutting-optimizer/'], ['zh/rebar-cutting-optimizer', '/zh/help/cutting-optimizer/'],
    ['tools/bbs-analyzer', '/help/bbs-analyzer/'], ['ar/tools/bbs-analyzer', '/ar/help/bbs-analyzer/'], ['zh/bbs-analyzer', '/zh/help/bbs-analyzer/']];
  for (const [t, guide] of tools) {
    const h = read(t);
    const links = [...h.matchAll(/<a (?:class="co-q" )?href="([^"]*\/help\/[^"]*)" target="_blank" rel="noopener">/g)].map(m => m[1]);
    assert.ok(links.length >= 4, t + ' has ' + links.length + ' help links');
    assert.ok(h.includes(`<p class="co-help"><a href="${guide}" target="_blank" rel="noopener">`), t + ' top link');
    for (const l of links) {
      assert.ok(l.startsWith(guide), `${t}: ${l} not ${guide}`);              // same language, same tool
      const frag = l.split('#')[1];
      if (frag) assert.ok(read(guide).includes(`id="${frag}"`), `${t}: #${frag}`);
    }
  }
});

test('help pages are light: no scripts besides the site script, no tracking', () => {
  for (const p of pages) {
    const h = read(p.url);
    const srcs = [...h.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(srcs, ['/assets/site.js?v=20261015'], p.url);
    assert.doesNotMatch(h, /googletagmanager|gtag\(|analytics|facebook\.net|hotjar|clarity\.ms/i, p.url);
    assert.ok(Buffer.byteLength(h) < 60000, p.url + ' ' + Buffer.byteLength(h) + ' bytes');
  }
});

test('the numbers in the guides are the numbers the tools produce', () => {
  // cutting optimizer example
  const o = CutOpt.optimize({ stockLength: 12000, kerf: 0, allowance: 0, minOffcut: 1000, items: [
    { diameter: 16, grade: 'Gr60', length: 2350, qty: 96 }, { diameter: 16, grade: 'Gr60', length: 3600, qty: 64 }, { diameter: 16, grade: 'Gr60', length: 4250, qty: 40 }] }).groups[0];
  assert.deepEqual([o.bars, o.optimal, o.wastePct.toFixed(2), (o.weightPurchasedKg / 1000).toFixed(3), o.reusableLength / 1000, o.scrapLength / 1000],
    [55, true, '5.15', '1.042', 11.9, 22.1]);
  for (const l of Object.keys(PREFIX)) {
    const g = text(read(PREFIX[l] + 'cutting-optimizer/'));
    for (const n of ['55', '5.15', '1.042', '11.90', '22.10', '94.85', '626', '660']) assert.ok(g.includes(n), `${l} optimizer guide ${n}`);
  }
  // BBS sample schedule
  const g = BBST.en.sample, d = BBS.detectHeader(g);
  const r = BBS.analyze(g, { headerRow: d.headerRow, mapping: d.mapping, units: d.units });
  assert.deepEqual([r.summary.totals.bars, r.summary.totals.lengthM.toFixed(2), (r.summary.totals.weightKg / 1000).toFixed(3), r.issues.map(i => i.row), r.notForOptimizer],
    [860, '1859.60', '2.080', [12, 13, 15], { rows: 1, bars: 20 }]);
  const t = BBS.buildTransfer(r.rows);
  const opt = CutOpt.optimize({ stockLength: 12000, kerf: 0, minOffcut: 1000, items: t.items.map(i => ({ diameter: i[0], grade: i[1], length: i[2], qty: i[3] })) });
  assert.deepEqual([t.items.length, opt.totals.bars, (opt.totals.weightPurchasedKg / 1000).toFixed(3), opt.totals.allOptimal], [7, 160, '2.209', true]);
  for (const l of Object.keys(PREFIX)) {
    const b = text(read(PREFIX[l] + 'bbs-analyzer/'));
    for (const n of ['860', '1,859.60', '2.080', '0.193', '160', '2.209']) assert.ok(b.includes(n), `${l} bbs guide ${n}`);
  }
  // weight check examples, by hand: 0.006165 x d^2
  const th = 0.006165 * 256 * 3;
  assert.equal(th.toFixed(5), '4.73472');
  assert.equal(((4.6 - th) / th * 100).toFixed(2), '-2.85');
  const pooledTheo = 0.006165 * 256 * 4.5, pooledAct = 3.10 + 0.80 + 3.20;
  assert.equal(((pooledAct - pooledTheo) / pooledTheo * 100).toFixed(2), '-0.03');
  for (const l of Object.keys(PREFIX)) {
    const w = text(read(PREFIX[l] + 'steel-weight-verification/'));
    for (const n of ['4.73472', '2.85', '7.10208', '0.03', '10.955', '10.900']) assert.ok(w.includes(n), `${l} weight guide ${n}`);
  }
});

test('the formula table matches the tools for every size', () => {
  const want = { 10: ['0.617', '7.40', '135.2'], 12: ['0.888', '10.65', '93.9'], 14: ['1.208', '14.50', '69.0'], 16: ['1.578', '18.94', '52.8'],
                 18: ['1.997', '23.97', '41.7'], 20: ['2.466', '29.59', '33.8'], 25: ['3.853', '46.24', '21.6'], 32: ['6.313', '75.76', '13.2'] };
  for (const [d, [kgm, bar, per]] of Object.entries(want)) {
    const m = CutOpt.massPerMetre(+d);
    assert.equal(m, BBS.unitWeight(+d));
    assert.equal(m.toFixed(3), kgm, 'kg/m ' + d);
    assert.equal((m * 12).toFixed(2), bar, 'bar ' + d);
    assert.equal((1000 / (m * 12)).toFixed(1), per, 'per tonne ' + d);
    for (const l of Object.keys(PREFIX)) assert.ok(read(PREFIX[l]).includes(`<td>${d}</td><td>${kgm}</td><td>${bar}</td><td>${per}</td>`), `${l} row ${d}`);
  }
});

test('sitemap lists the 12 help URLs with reciprocal alternates', () => {
  const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  for (const p of pages) {
    const block = (sm.match(new RegExp(`<url>\\s*<loc>${(SITE + p.url).replace(/[.]/g, '\\.')}</loc>[\\s\\S]*?</url>`)) || [])[0];
    assert.ok(block, p.url);
    for (const l of Object.keys(PREFIX)) assert.ok(block.includes(`href="${SITE + PREFIX[l] + p.s}"`), `${p.url} alt ${l}`);
  }
});
