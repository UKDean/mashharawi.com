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
const SLUGS = ['', 'cutting-optimizer/', 'bbs-analyzer/', 'steel-weight-verification/', 'construction-dictionary/', 'smart-rfq-generator/'];
const LANG = { en: ['en', 'ltr'], ar: ['ar', 'rtl'], zh: ['zh-Hans', 'ltr'] };
const read = (url) => fs.readFileSync(path.join(ROOT, url, 'index.html'), 'utf8');
const main = (html) => (html.match(/<main[\s\S]*?<\/main>/) || [''])[0];
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ');
// Every link target must exist in this branch: no pending pages.
const PENDING = new Set();
const pages = [];
for (const l of Object.keys(PREFIX)) for (const s of SLUGS) pages.push({ l, s, url: PREFIX[l] + s });

test('all 18 pages exist with the right language, direction and canonical URL', () => {
  assert.equal(pages.length, 18);
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

/* Language check for one page's <main>. Returns a list of problems (empty
   when the page is clean). Text in a span with its own lang attribute is
   left out of the counts only if it is a quoted term: the span holds plain
   text in the script of the language it declares, at most 3 words and 24
   characters, and all such spans together hold at most 200 characters.
   Anything else marked with lang is reported, so a passage that was not
   translated cannot be hidden by wrapping it in a span. */
const SCRIPT = { ar: /^[؀-ۿ\s،]+$/, 'zh-Hans': /^[㐀-鿿\s、，]+$/, en: /^[A-Za-z0-9\s.,'’()\-]+$/ };
function languageProblems(mainHtml, l) {
  const AR = /[؀-ۿ]/, CJK = /[一-鿿]/, own = LANG[l][0], problems = [];
  const heads = [...mainHtml.matchAll(/<(h1|h2|h3|summary|th)[^>]*>([\s\S]*?)<\/\1>/g)].map(x => text(x[2]).trim()).filter(Boolean);
  for (const hd of heads) {
    if (/^[\d\s.×Ø%()\-–kgm/]+$|^(kg\/m|Ø mm|Gr60|BBS|MTC|RebarPlan)$/.test(hd)) continue;   // numbers and units
    if (l === 'ar' && !AR.test(hd)) problems.push('heading not in Arabic: ' + hd);
    if (l === 'zh' && !CJK.test(hd)) problems.push('heading not in Chinese: ' + hd);
    if (l === 'en' && (AR.test(hd) || CJK.test(hd))) problems.push('heading not in English: ' + hd);
  }
  let budget = 0;
  const cleaned = mainHtml.replace(/<span lang="([^"]+)"[^>]*>([^<]*)<\/span>/g, (x, lang, inner) => {
    if (lang === own) return x;
    const t = inner.replace(/&[a-z#0-9]+;/g, ' ').trim();
    const ok = SCRIPT[lang] && SCRIPT[lang].test(t) && t.length <= 24 && t.split(/\s+/).length <= 3;
    if (!ok) { problems.push(`marked ${lang} text is not a short quoted term: "${t.slice(0, 60)}"`); return x; }
    budget += t.length;
    return ' ';
  });
  if (budget > 200) problems.push('too much marked foreign text: ' + budget + ' characters');
  const body = text(cleaned);
  const n = re => (body.match(re) || []).length;
  if (l === 'en') { if (n(/[؀-ۿ]/g) >= 40) problems.push('Arabic text in English page'); if (n(/[一-鿿]/g) >= 20) problems.push('Chinese text in English page'); }
  if (l === 'ar') { if (n(/[؀-ۿ]/g) <= 1500) problems.push('too little Arabic'); if (n(/[一-鿿]/g) >= 20) problems.push('Chinese text in Arabic page'); }
  if (l === 'zh') { if (n(/[一-鿿]/g) <= 800) problems.push('too little Chinese'); if (n(/[؀-ۿ]/g) >= 40) problems.push('Arabic text in Chinese page'); }
  // no English sentences on the Arabic and Chinese pages (product names and units are allowed)
  if (l !== 'en' && /\b(the|and|with|from|this|that|your|which)\s+(the|a|an|is|are|tool|bars?|cut|length|weight)\b/i.test(body)) problems.push('English sentence in ' + l + ' page');
  return problems;
}

test('no mixed languages: headings, navigation and body follow the page language', () => {
  for (const p of pages) assert.deepEqual(languageProblems(main(read(p.url)), p.l), [], p.url);
});

test('the language check still catches untranslated content (control cases)', () => {
  const en = body => `<main><h2 id="x">Heading</h2><p>${'English text. '.repeat(20)}${body}</p></main>`;
  const arFill = 'نص عربي '.repeat(260), zhFill = '中文内容'.repeat(260);
  const ar = body => `<main><h2 id="x">عنوان</h2><p>${arFill}${body}</p></main>`;
  const zh = body => `<main><h2 id="x">标题</h2><p>${zhFill}${body}</p></main>`;
  const para = 'هذه فقرة عربية كاملة لم تترجم إلى الإنجليزية في الصفحة';
  // clean: a few short, correctly marked terms
  assert.deepEqual(languageProblems(en('Type <span lang="ar" dir="rtl">كانات</span> or <span lang="zh-Hans">箍筋</span>.'), 'en'), []);
  // an untranslated Arabic paragraph, unmarked
  assert.ok(languageProblems(en(para + para), 'en').includes('Arabic text in English page'));
  // the same paragraph wrapped in a lang span is reported, not ignored
  assert.ok(languageProblems(en(`<span lang="ar" dir="rtl">${para}</span>`), 'en').some(x => x.startsWith('marked ar text')));
  // a lang attribute that does not match the script inside
  assert.ok(languageProblems(en('<span lang="ar">not Arabic</span>'), 'en').some(x => x.startsWith('marked ar text')));
  // many short marked terms add up
  assert.ok(languageProblems(en('<span lang="ar">كلمة عربية طويلة</span> '.repeat(20)), 'en').some(x => x.startsWith('too much marked')));
  // English left in an Arabic page, marked or not
  assert.ok(languageProblems(ar('Use the tool and check the length.'), 'ar').includes('English sentence in ar page'));
  assert.ok(languageProblems(ar('<span lang="en">Use the tool and check the length of the bars</span>'), 'ar').some(x => x.startsWith('marked en text')));
  // Chinese left in an Arabic page; Arabic left in a Chinese page
  assert.ok(languageProblems(ar('钢筋下料表分析工具使用指南计算实例结果解读'), 'ar').includes('Chinese text in Arabic page'));
  assert.ok(languageProblems(zh(para), 'zh').includes('Arabic text in Chinese page'));
  // headings in the wrong language
  assert.ok(languageProblems('<main><h2>Getting started</h2><p>' + arFill + '</p></main>', 'ar').some(x => x.startsWith('heading not in Arabic')));
  assert.ok(languageProblems('<main><h3>البداية</h3></main>', 'en').some(x => x.startsWith('heading not in English')));
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
  assert.equal(pendingSeen.size, 0);
});

test('Help links inside the tools: right language, new tab, existing anchors', () => {
  const tools = [
    ['tools/cutting-optimizer', '/help/cutting-optimizer/'], ['ar/tools/cutting-optimizer', '/ar/help/cutting-optimizer/'], ['zh/rebar-cutting-optimizer', '/zh/help/cutting-optimizer/'],
    ['tools/bbs-analyzer', '/help/bbs-analyzer/'], ['ar/tools/bbs-analyzer', '/ar/help/bbs-analyzer/'], ['zh/bbs-analyzer', '/zh/help/bbs-analyzer/'],
    ['tools/steel-weight-verification', '/help/steel-weight-verification/'], ['ar/tools/steel-weight-verification', '/ar/help/steel-weight-verification/'], ['zh/steel-weight-verification', '/zh/help/steel-weight-verification/']];
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

test('sitemap lists the 18 help URLs with reciprocal alternates', () => {
  const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  for (const p of pages) {
    const block = (sm.match(new RegExp(`<url>\\s*<loc>${(SITE + p.url).replace(/[.]/g, '\\.')}</loc>[\\s\\S]*?</url>`)) || [])[0];
    assert.ok(block, p.url);
    for (const l of Object.keys(PREFIX)) assert.ok(block.includes(`href="${SITE + PREFIX[l] + p.s}"`), `${p.url} alt ${l}`);
  }
});

/* ---- BBS: formats, limits and privacy match the code ------------------- */
const BBSX = require('../assets/bbs/xlsx.js');
const BBS_TOOL = { en: 'tools/bbs-analyzer', ar: 'ar/tools/bbs-analyzer', zh: 'zh/bbs-analyzer' };

test('BBS: the file picker, the upload text and the guide list the same formats', () => {
  for (const l of Object.keys(PREFIX)) {
    const tool = read(BBS_TOOL[l]);
    const accept = tool.match(/<input id="bFile" type="file" accept="([^"]+)">/)[1].split(',');
    const exts = accept.filter(a => a.startsWith('.'));
    assert.deepEqual(exts, ['.xlsx', '.xlsm', '.csv', '.tsv', '.txt'], l);
    for (const bad of ['.xls', '.xlsb', '.ods', 'application/vnd.ms-excel', 'text/plain']) assert.ok(!accept.includes(bad), l + ' accepts ' + bad);
    const drop = tool.match(/<label class="b-drop"[\s\S]*?<b>([^<]+)<\/b>\s*<small>([^<]+)<\/small>/);
    for (const e of exts) assert.ok(drop[1].includes(e), `${l} upload text lacks ${e}`);
    assert.ok(/25/.test(drop[2]), l + ' upload text shows the size limit');
    const faq = text(tool);
    for (const e of exts.concat(['.xls', '.xlsb', '.ods'])) assert.ok(faq.includes(e), `${l} tool FAQ ${e}`);
    const g = read(PREFIX[l] + 'bbs-analyzer/'), body = text(main(g));
    for (const f of ['XLSX', 'XLSM', 'CSV', 'TSV', 'TXT', 'XLS', 'XLSB', 'ODS', 'CSV UTF-8']) assert.ok(body.includes(f), `${l} guide ${f}`);
    for (const e of exts) assert.ok(body.includes(e), `${l} guide picker sentence ${e}`);
    assert.ok(g.includes('id="file-limits"') && g.includes('id="privacy"'), l + ' anchors');
  }
});

test('BBS: the limits in the guides are the limits in the code', () => {
  assert.equal(BBSX.LIMITS.fileBytes, 25 * 1024 * 1024);
  assert.equal(BBSX.LIMITS.rows, 100000);
  assert.equal(BBS.LIMITS.rows, 100000);
  assert.equal(BBSX.LIMITS.cols, 200);
  assert.equal(BBSX.LIMITS.sheets, 50);
  const app = fs.readFileSync(path.join(ROOT, 'assets/bbs/app.js'), 'utf8');
  assert.ok(app.includes('file.size > window.BbsXlsx.LIMITS.fileBytes'), 'size checked for every file before reading');
  for (const l of Object.keys(PREFIX)) {
    const lim = (read(PREFIX[l] + 'bbs-analyzer/').match(/id="file-limits"[\s\S]*?<\/table>/) || [''])[0];
    for (const n of ['25', '100,000', '200', '50']) assert.ok(text(lim).includes(n), `${l} limit ${n}`);
  }
  // 100,000 data rows of text are analysed, one more is refused
  const rows = n => E => { const g = [['Dia (mm)', 'Cut length (mm)', 'Total No.']]; for (let i = 0; i < n; i++) g.push([16, 2350, 1]); return g; };
  const go = g => { const d = BBS.detectHeader(g); return BBS.analyze(g, { headerRow: d.headerRow, mapping: d.mapping, units: d.units }); };
  assert.equal(go(rows(100000)()).summary.totals.bars, 100000);
  assert.equal(go(rows(100001)()).error, 'tooManyRows');
});

test('BBS: unsupported formats get their own message in every language', () => {
  const app = fs.readFileSync(path.join(ROOT, 'assets/bbs/app.js'), 'utf8');
  assert.ok(app.includes("/\\.xls$/.test(lower)") && app.includes("/\\.xlsb$/.test(lower)") && app.includes("/\\.(ods|fods)$/.test(lower)"));
  assert.ok(/0x50 && b\[1\] === 0x4b/.test(app) && /0xd0 && b\[1\] === 0xcf/.test(app), 'ZIP and OLE files are not read as text');
  for (const l of ['en', 'ar', 'zh']) for (const k of ['xls', 'xlsb', 'ods', 'binary', 'tooLarge']) assert.ok(BBST[l].msg.xlsx[k], `${l} msg ${k}`);
});

test('BBS: privacy statements are true of the code', () => {
  for (const f of ['assets/bbs/app.js', 'assets/bbs/engine.js', 'assets/bbs/xlsx.js', 'assets/bbs/i18n.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.doesNotMatch(src, /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|document\.cookie|caches\./, f);
  }
  const app = fs.readFileSync(path.join(ROOT, 'assets/bbs/app.js'), 'utf8');
  assert.ok(app.includes("OPT_URL + '#bbs='"), 'hand-off travels after # only');
  for (const l of ['en', 'ar', 'zh']) assert.doesNotMatch(read(BBS_TOOL[l]), /<form\b/, l + ' no form posts');
  const words = { en: ['locally', 'Not uploaded', 'Not stored', 'Closing the tab'], ar: ['محلية', 'لا يُرفع', 'لا يُحفظ', 'إغلاق التبويب'], zh: ['本地处理', '不上传', '不保存', '关闭标签页'] };
  for (const l of Object.keys(words)) {
    const sec = (read(PREFIX[l] + 'bbs-analyzer/').match(/<h2 id="privacy">[\s\S]*?<h2 /) || [''])[0];
    for (const w of words[l]) assert.ok(text(sec).includes(w), `${l} privacy: ${w}`);
  }
});
