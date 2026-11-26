/* Site-wide consistency checks on the built HTML, added after the Phase 1
   post-merge audit. They guard against the problems that audit found:
   a page left out of the sitemap, Chinese pages with different menus,
   pages loading an old copy of site.css, tool indexes that miss a tool,
   and help text that still counts three tools. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://mashharawi.com';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'motion', 'tests', 'scripts', 'notes', '.github']);

function htmlPages(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) htmlPages(path.join(dir, e.name), out); }
    else if (e.name === 'index.html') out.push('/' + path.relative(ROOT, dir).split(path.sep).join('/') + (dir === ROOT ? '' : '/'));
  }
  return out.map((u) => u.replace(/^\/\/$/, '/')).sort();
}
const read = (url) => fs.readFileSync(path.join(ROOT, url, 'index.html'), 'utf8');
const navOf = (html) => {
  const m = html.match(/<nav class="c-header__nav"[^>]*>([\s\S]*?)<\/nav>/);
  return m ? [...m[1].matchAll(/<a href="([^"]+)"([^>]*)>([^<]*)<\/a>/g)].map((a) => ({ href: a[1], attrs: a[2], label: a[3] })) : null;
};
const PAGES = htmlPages();
const SITEMAP = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const LOCS = new Set([...SITEMAP.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(SITE, '')));

test('every indexable page is in the sitemap, and every sitemap URL is an indexable page', () => {
  const missing = [];
  for (const u of PAGES) {
    const h = read(u);
    const robots = (h.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || '';
    if (/noindex/.test(robots)) { assert.ok(!LOCS.has(u), `${u} is noindex but listed in the sitemap`); continue; }
    if (!LOCS.has(u)) missing.push(u);
  }
  assert.deepEqual(missing, [], 'indexable pages missing from sitemap.xml');
  for (const u of LOCS) {
    assert.ok(fs.existsSync(path.join(ROOT, u, 'index.html')), `sitemap URL ${u} has no page`);
  }
});

test('every Chinese page has the same header menu, with the current section marked', () => {
  const zh = PAGES.filter((u) => u.startsWith('/zh/'));
  assert.ok(zh.length >= 21);
  let ref = null;
  for (const u of zh) {
    const nav = navOf(read(u));
    assert.ok(nav, `${u}: no header menu`);
    const items = nav.filter((a) => !a.attrs.includes('c-header__lang'));
    const langs = nav.filter((a) => a.attrs.includes('c-header__lang'));
    assert.equal(langs.length, 2, `${u}: expected English and Arabic links`);
    const sig = items.map((a) => a.href + ' ' + a.label).join('|');
    if (ref === null) ref = sig;
    assert.equal(sig, ref, `${u}: menu differs from the other Chinese pages`);
    assert.ok(items.some((a) => a.href === '/zh/tools/') && items.some((a) => a.href === '/zh/help/'), `${u}: menu lacks 工具 or 帮助`);
    const current = items.filter((a) => a.attrs.includes('aria-current="page"')).map((a) => a.href);
    const expect = u.startsWith('/zh/help/') ? ['/zh/help/']
      : ['/zh/tools/', '/zh/rebar-cutting-optimizer/', '/zh/bbs-analyzer/', '/zh/steel-weight-verification/'].some((p) => u.startsWith(p)) ? ['/zh/tools/']
      : items.some((a) => a.href === u) ? [u] : [];
    assert.deepEqual(current, expect, `${u}: wrong current menu item`);
  }
});

test('every page loads the same version of site.css', () => {
  const versions = new Map();
  for (const u of PAGES) {
    const m = read(u).match(/\/assets\/site\.css\?v=([0-9a-z]+)/);
    if (m) versions.set(m[1], (versions.get(m[1]) || []).concat(u));
  }
  assert.equal(versions.size, 1, 'site.css versions in use: ' + [...versions.keys()].join(', '));
});

test('header menu links stay on one line and the tablet spacing rule exists', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets/site.css'), 'utf8');
  assert.match(css, /\.c-header__nav a\{[^}]*white-space:nowrap/);
  assert.match(css, /@media \(min-width:761px\) and \(max-width:1100px\)\{[^}]*\.c-header\{gap:20px\}/);
});

const TOOLS = {
  en: ['/tools/cutting-optimizer/', '/tools/bbs-analyzer/', '/tools/steel-weight-verification/', '/tools/construction-dictionary/', '/tools/smart-rfq-generator/'],
  ar: ['/ar/tools/cutting-optimizer/', '/ar/tools/bbs-analyzer/', '/ar/tools/steel-weight-verification/', '/ar/tools/construction-dictionary/', '/ar/tools/smart-rfq-generator/'],
  zh: ['/zh/rebar-cutting-optimizer/', '/zh/bbs-analyzer/', '/zh/steel-weight-verification/', '/zh/tools/construction-dictionary/', '/zh/tools/smart-rfq-generator/'],
};
const INDEX = { en: '/tools/', ar: '/ar/tools/', zh: '/zh/tools/' };

test('each tools index links all five Phase 1 tools and the three indexes are hreflang twins', () => {
  for (const [l, idx] of Object.entries(INDEX)) {
    const h = read(idx);
    const main = (h.match(/<main[\s\S]*?<\/main>/) || [''])[0];
    for (const t of TOOLS[l]) assert.ok(main.includes(`href="${t}"`), `${idx} does not link ${t}`);
    assert.ok(h.includes(`<link rel="canonical" href="${SITE}${idx}">`), `${idx}: canonical`);
    for (const [l2, idx2] of Object.entries(INDEX)) {
      const hl = { en: 'en', ar: 'ar', zh: 'zh-Hans' }[l2];
      assert.ok(h.includes(`<link rel="alternate" hreflang="${hl}" href="${SITE}${idx2}">`), `${idx}: missing hreflang ${hl}`);
    }
    const nav = navOf(h);
    const others = nav.filter((a) => a.attrs.includes('c-header__lang')).map((a) => a.href).sort();
    assert.deepEqual(others, Object.entries(INDEX).filter(([k]) => k !== l).map(([, v]) => v).sort(), `${idx}: language links`);
  }
});

test('tools and help index descriptions mention the dictionary and the RFQ generator', () => {
  const words = {
    en: [/dictionary/i, /RFQ/], ar: [/قاموس/, /طلب عرض السعر/], zh: [/术语词典/, /询价单/],
  };
  const pages = { en: ['/tools/', '/help/'], ar: ['/ar/tools/', '/ar/help/'], zh: ['/zh/tools/', '/zh/help/'] };
  for (const l of Object.keys(pages)) for (const u of pages[l]) {
    const d = (read(u).match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    for (const w of words[l]) assert.match(d, w, `${u} description: ${d}`);
  }
});

test('help indexes no longer say there are three tools', () => {
  const bad = { '/help/': /three tools for/i, '/ar/help/': /ثلاث أدوات/, '/zh/help/': /三个钢筋工具/ };
  for (const [u, re] of Object.entries(bad)) assert.doesNotMatch(read(u), re, u);
});

test('every article ends with a tools box that links the RFQ generator in its own language', () => {
  const arts = PAGES.filter((u) => /^\/(ar\/)?writing\/[^/]+\/$/.test(u) || /^\/writing\/[^/]+\/$/.test(u));
  assert.ok(arts.length >= 8, `found ${arts.length} articles`);
  for (const u of arts) {
    const h = read(u);
    const box = (h.match(/<section class="note-tools"[\s\S]*?<\/section>/) || [''])[0];
    assert.ok(box, `${u}: no tools box`);
    const ar = /<html lang="ar"/.test(h);
    assert.ok(box.includes(`href="${ar ? '/ar' : ''}/tools/smart-rfq-generator/"`), `${u}: RFQ link missing or wrong language`);
    const links = [...box.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(links.length, 3, `${u}: expected 3 tools`);
    for (const l of links) assert.ok(PAGES.includes(l), `${u}: ${l} does not exist`);
  }
});
