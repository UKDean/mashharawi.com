/* On-page SEO gate, run on every pull request by the Tests workflow.

   The daily Site health workflow crawls the LIVE site. This file checks the
   repository BEFORE a change is merged, so a broken page never ships:

     - every indexable page has a <title>, a meta description of at most
       170 characters (over 160 is reported), exactly one <h1>, <html lang> and a self canonical
     - titles and descriptions are unique across the site
     - every <img> has an alt attribute (alt="" is fine for decoration)
     - every internal href/src points at a file or folder that exists
     - hreflang alternates point at real pages and are reciprocal
     - every JSON-LD block parses, and every FAQPage question appears on the page

   Titles longer than 65 characters are reported (Google cuts them in the
   result), not failed. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://mashharawi.com';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'motion', 'tests', 'scripts', 'notes', '.github', 'docs']);

function walk(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p, out); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const FILES = walk();
const urlOf = (f) => '/' + path.relative(ROOT, path.dirname(f)).split(path.sep).join('/') + '/';
const PAGES = FILES.filter((f) => path.basename(f) === 'index.html')
  .map((f) => ({ url: urlOf(f).replace(/^\/\/$/, '/'), html: fs.readFileSync(f, 'utf8') }));
const INDEXABLE = PAGES.filter((p) => !/<meta name="robots" content="[^"]*noindex/.test(p.html));
const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const title = (h) => (h.match(/<title>([^<]*)<\/title>/) || [])[1];
const desc = (h) => (h.match(/<meta name="description" content="([^"]*)"/) || [])[1];

test('every indexable page has a title, a short description, one h1, lang and a self canonical', () => {
  const bad = [];
  for (const { url, html } of INDEXABLE) {
    const t = title(html), d = desc(html);
    if (!t || !t.trim()) bad.push(`${url}: no <title>`);
    if (!d) bad.push(`${url}: no meta description`);
    else if (unescape(d).length > 170) bad.push(`${url}: description is ${unescape(d).length} chars (max 170)`);
    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) bad.push(`${url}: ${h1} <h1> elements`);
    if (!/<html[^>]*\slang="[^"]+"/.test(html)) bad.push(`${url}: no <html lang>`);
    const c = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    if (c !== SITE + url) bad.push(`${url}: canonical is ${c || 'missing'}`);
  }
  assert.deepEqual(bad, []);
});

test('titles and descriptions are unique', () => {
  const seen = { t: new Map(), d: new Map() };
  const dup = [];
  for (const { url, html } of INDEXABLE) {
    for (const [k, v] of [['t', title(html)], ['d', desc(html)]]) {
      if (!v) continue;
      if (seen[k].has(v)) dup.push(`${url} repeats the ${k === 't' ? 'title' : 'description'} of ${seen[k].get(v)}`);
      else seen[k].set(v, url);
    }
  }
  assert.deepEqual(dup, []);
});

test('long titles and descriptions are reported', () => {
  const report = (label, max, get) => {
    const long = INDEXABLE.map((p) => [p.url, unescape(get(p.html) || '')]).filter(([, t]) => t.length > max);
    if (long.length) console.log(`${long.length} ${label} over ${max} chars, Google may cut them:\n` + long.map(([u, t]) => `  ${t.length}  ${u}`).join('\n'));
  };
  report('title(s)', 65, title);
  report('description(s)', 160, desc);
});

test('every <img> has an alt attribute', () => {
  const bad = [];
  for (const f of FILES) {
    const h = fs.readFileSync(f, 'utf8');
    for (const m of h.matchAll(/<img\b[^>]*>/g)) if (!/\salt=/.test(m[0])) bad.push(path.relative(ROOT, f) + ': ' + m[0].slice(0, 80));
  }
  assert.deepEqual(bad, []);
});

test('internal links and assets resolve to files in the repository', () => {
  const bad = [];
  for (const f of FILES) {
    const h = fs.readFileSync(f, 'utf8');
    for (const m of h.matchAll(/\s(?:href|src)="(\/[^"#?]*)/g)) {
      const u = m[1];
      if (u.startsWith('//')) continue;
      const p = path.join(ROOT, decodeURI(u));
      const ok = fs.existsSync(p) && (fs.statSync(p).isFile() || fs.existsSync(path.join(p, 'index.html')));
      if (!ok) bad.push(`${path.relative(ROOT, f)} -> ${u}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('hreflang alternates exist and point back', () => {
  const alts = new Map(PAGES.map(({ url, html }) => [url,
    [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="https:\/\/mashharawi\.com([^"]+)"/g)].map((m) => m[2])]));
  const bad = [];
  for (const [url, list] of alts) {
    for (const t of list) {
      if (t === url) continue;
      if (!alts.has(t)) bad.push(`${url} -> ${t} (no such page)`);
      else if (!alts.get(t).includes(url)) bad.push(`${url} -> ${t} (no hreflang back)`);
    }
  }
  assert.deepEqual(bad, []);
});

test('JSON-LD parses, and FAQPage questions are visible on the page', () => {
  const bad = [];
  for (const { url, html } of PAGES) {
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let o;
      try { o = JSON.parse(m[1]); } catch (e) { bad.push(`${url}: JSON-LD does not parse (${e.message})`); continue; }
      if (o['@type'] === 'FAQPage') {
        const text = unescape(html.replace(/<script[\s\S]*?<\/script>/g, ''));
        for (const q of o.mainEntity || []) if (!text.includes(q.name)) bad.push(`${url}: FAQ question not on the page: ${q.name}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
