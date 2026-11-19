/* Construction Dictionary: data validation, duplicate detection, search in
   three languages, filtering, highlighting, copy text, and the static pages
   (languages, RTL, hreflang, cards in step with terms.json, help links,
   internal links, safe rendering, no network or storage use). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../assets/construction-dictionary/dictionary.js');
const TXT = require('../assets/construction-dictionary/i18n.js');

const ROOT = path.join(__dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/construction-dictionary/terms.json'), 'utf8'));
const IX = D.buildIndex(DATA);
const BY = Object.fromEntries(DATA.terms.map(t => [t.id, t]));
const clone = () => JSON.parse(JSON.stringify(DATA));
const ids = (q, opts) => D.search(IX, q, Object.assign({ lang: 'en' }, opts)).results.map(r => r.id);
const SITE = 'https://mashharawi.com';
const PAGES = { en: '/tools/construction-dictionary/', ar: '/ar/tools/construction-dictionary/', zh: '/zh/tools/construction-dictionary/' };
const HELP = { en: '/help/construction-dictionary/', ar: '/ar/help/construction-dictionary/', zh: '/zh/help/construction-dictionary/' };
const HL = { en: 'en', ar: 'ar', zh: 'zh-Hans' };
const read = u => fs.readFileSync(path.join(ROOT, u, 'index.html'), 'utf8');
const unesc = s => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/* ---- data ---------------------------------------------------------------- */
test('terms.json passes validation with no errors', () => {
  const v = D.validate(DATA);
  assert.deepEqual(v.errors, []);
});

test('dataset: at least 150 terms, all ten categories used, required terms present', () => {
  assert.ok(DATA.terms.length >= 150, DATA.terms.length + ' terms');
  assert.deepEqual(DATA.categories.map(c => c.id), ['rebar', 'concrete', 'structural', 'civil', 'site', 'procurement', 'qaqc', 'logistics', 'drawings', 'safety']);
  for (const c of DATA.categories) assert.ok(DATA.terms.filter(t => t.category === c.id).length >= 10, c.id);
  const names = new Set();
  for (const t of DATA.terms) { names.add(D.norm(t.term.en)); t.synonyms.en.forEach(s => names.add(D.norm(s))); if (t.abbreviation) names.add(D.norm(t.abbreviation)); }
  const required = ['Reinforcing Steel', 'Rebar', 'Deformed Bar', 'Yield Strength', 'Tensile Strength', 'Elongation', 'Nominal Diameter', 'Unit Weight',
    'Mill Test Certificate', 'Bar Bending Schedule', 'Concrete Cover', 'Development Length', 'Lap Splice', 'Hook', 'Stirrup', 'Beam', 'Column', 'Slab',
    'Foundation', 'Formwork', 'Concrete Slump', 'Compressive Strength', 'Material Submittal', 'Purchase Order', 'Delivery Note', 'Inspection Request',
    'Non-Conformance Report', 'Heat Number', 'Batch Number', 'Tolerance'];
  for (const r of required) assert.ok(names.has(D.norm(r)), 'missing ' + r);
});

test('every entry has all three terms and definitions, typed correctly', () => {
  for (const t of DATA.terms) {
    for (const l of D.LANGS) {
      assert.equal(typeof t.term[l], 'string'); assert.ok(t.term[l].length > 0);
      assert.equal(typeof t.definition[l], 'string'); assert.ok(t.definition[l].length >= (l === 'zh' ? 10 : 20), t.id + ' ' + l + ' definition too short');   // Chinese is denser
      assert.ok(Array.isArray(t.synonyms[l]));
    }
    assert.match(t.term.ar, /[؀-ۿ]/, t.id + ' Arabic term has Arabic script');
    assert.match(t.definition.ar, /[؀-ۿ]/, t.id + ' Arabic definition');
    assert.match(t.term.zh, /[一-鿿]|^[A-Z0-9 ]+/, t.id + ' Chinese term');
    assert.match(t.definition.zh, /[一-鿿]/, t.id + ' Chinese definition');
    assert.doesNotMatch(t.definition.en, /[؀-ۿ一-鿿]/, t.id + ' English definition is English');
  }
});

test('validator: catches each kind of data error', () => {
  const errs = mutate => { const d = clone(); mutate(d); return D.validate(d).errors.join('\n'); };
  assert.match(errs(d => { d.terms[1].id = d.terms[0].id; }), /duplicate id/);
  assert.match(errs(d => { d.terms[0].id = 'Bad Id'; }), /id must be/);
  assert.match(errs(d => { d.terms[0].term.ar = ''; }), /term\.ar missing/);
  assert.match(errs(d => { delete d.terms[0].definition.zh; }), /definition\.zh missing/);
  assert.match(errs(d => { d.terms[0].term.en = ' padded'; }), /not a trimmed string/);
  assert.match(errs(d => { d.terms[0].category = 'nope'; }), /unknown category/);
  assert.match(errs(d => { d.terms[0].related = ['no-such-term']; }), /does not exist/);
  assert.match(errs(d => { d.terms[0].related = [d.terms[0].id]; }), /related to itself/);
  assert.match(errs(d => { d.terms[0].synonyms.en = ['']; }), /empty or not a string/);
  assert.match(errs(d => { d.terms[0].synonyms.en = 'rebar'; }), /must be an array/);
  assert.match(errs(d => { d.terms[0].synonyms.en = [d.terms[0].term.en.toUpperCase()]; }), /repeats the term itself/);
  assert.match(errs(d => { d.terms[0].related = 'beam'; }), /related must be an array/);
  assert.match(errs(d => { d.terms[0].abbreviation = 5; }), /abbreviation/);
  assert.match(errs(d => { d.terms[0].example = { en: 'x' }; }), /example\.ar missing/);
  assert.match(errs(d => { d.terms[0].review = ['fr']; }), /review language/);
  assert.match(errs(d => { d.terms[0].extra = 1; }), /unknown field/);
  assert.match(errs(d => { d.categories[0].name.zh = ''; }), /name\.zh missing/);
  assert.match(errs(d => { d.terms = 'x'; }), /terms must be/);
});

test('duplicates: same term twice, a synonym that is another term, and shared synonyms', () => {
  const d1 = clone(); d1.terms[1].term.zh = d1.terms[0].term.zh;
  assert.match(D.validate(d1).errors.join('\n'), /duplicate zh term/);
  // normalisation applies: case, Arabic letter forms and diacritics
  const d2 = clone(); d2.terms[1].term.ar = 'حَديد التسليح'.replace('ح', 'ح');
  d2.terms[0].term.ar = 'حديد التسليح';
  assert.match(D.validate(d2).errors.join('\n'), /duplicate ar term/);
  const d3 = clone(); d3.terms[0].synonyms.en.push(d3.terms[5].term.en);
  assert.match(D.validate(d3).errors.join('\n'), /is the term of/);
  const d4 = clone(); d4.terms[0].synonyms.en.push('shared word'); d4.terms[1].synonyms.en.push('Shared Word');
  assert.match(D.validate(d4).errors.join('\n'), /shared by .*sharedSynonyms/);
  d4.sharedSynonyms = [{ lang: 'en', text: 'shared word', reason: 'test' }];
  assert.deepEqual(D.validate(d4).errors, []);
  assert.equal(D.validate(d4).warnings.length, 1);
  const d5 = clone(); d5.sharedSynonyms = [{ lang: 'en', text: 'unused', reason: 'x' }];
  assert.match(D.validate(d5).errors.join('\n'), /not shared by any terms/);
});

test('every related reference resolves and no entry is orphaned from its category', () => {
  for (const t of DATA.terms) for (const r of t.related) assert.ok(BY[r], t.id + ' -> ' + r);
  assert.ok(DATA.terms.filter(t => t.related.length).length / DATA.terms.length > 0.9, 'most entries link to related terms');
});

test('review flags are used for uncertain translations', () => {
  const flagged = DATA.terms.filter(t => t.review);
  assert.ok(flagged.length >= 10);
  for (const t of flagged) for (const l of t.review) assert.ok(D.LANGS.includes(l));
  assert.ok(BY['development-length'].review.includes('ar'));
  assert.ok(BY.rfi.review.includes('zh'));
});

test('reviewed terminology: precise terms, no misleading or over-broad synonyms', () => {
  const syn = (id, l) => BY[id].synonyms[l].map(D.norm);
  // over-broad or wrong-document synonyms removed
  assert.ok(!syn('reinforcing-steel', 'ar').includes(D.norm('حديد')), '“حديد” alone is too broad');
  assert.ok(!syn('purchase-order', 'en').includes('order'));
  assert.ok(!syn('purchase-order', 'ar').includes(D.norm('طلب شراء')), 'a purchase request is not an order');
  for (const w of ['delivery order', 'waybill']) assert.ok(!syn('delivery-note', 'en').includes(w), w);
  assert.ok(!syn('delivery-note', 'ar').includes(D.norm('بوليصة التسليم')));
  assert.ok(!syn('delivery-note', 'zh').includes('运单'));
  for (const g of ['grade 60', 'gr60', 'grade 80', 'gr80']) assert.ok(!syn('grade', 'en').includes(g), 'an example grade is not a synonym');
  assert.ok(!syn('grade', 'ar').some(x => /[a-z]/.test(x)), 'no English in Arabic synonyms');
  assert.ok(!syn('mass-tolerance', 'en').includes('weight deviation') && !syn('mass-tolerance', 'ar').includes(D.norm('انحراف الوزن')), 'deviation is not tolerance');
  assert.ok(!syn('concrete-slump', 'en').includes('workability'), 'slump is not workability');
  assert.ok(!syn('development-length', 'en').includes('embedment length'));
  assert.ok(!syn('bend-diameter', 'en').includes('mandrel diameter'), 'mandrel diameter is related, not the same');
  assert.ok(!syn('weldable', 'en').includes('low-alloy rebar'));
  assert.ok(!syn('consultant', 'en').includes('engineer') && !syn('consultant', 'ar').includes(D.norm('الإشراف')));
  // Chinese consultant: a general term, the two roles named and kept apart
  const c = BY.consultant;
  assert.equal(c.term.zh, '工程咨询单位');
  assert.ok(!c.term.zh.includes('/'));
  assert.ok(c.synonyms.zh.includes('监理单位') && c.synonyms.zh.includes('设计单位'));
  assert.match(c.definition.zh, /监理单位/); assert.match(c.definition.zh, /设计单位/); assert.match(c.definition.zh, /不能互换/);
  assert.ok(!c.review, 'resolved');
  // actual weight: measured, compared with the standard's tolerance, no automatic compliance
  const aw = BY['actual-weight'].definition;
  assert.match(aw.en, /calibrated/); assert.match(aw.en, /product standard/); assert.match(aw.en, /compared/); assert.match(aw.en, /does not by itself show compliance/);
  assert.doesNotMatch(aw.en, /differs from the theoretical weight within/);
  assert.match(aw.ar, /معاير/); assert.match(aw.ar, /لا يثبت المطابقة/);
  assert.match(aw.zh, /校准/); assert.match(aw.zh, /并不说明符合要求/);
  // requirements that depend on a standard say so
  assert.match(BY['mass-tolerance'].definition.en, /product standard or the project specification/);
  assert.match(BY['development-length'].definition.en, /ACI 318/); assert.match(BY['development-length'].definition.en, /Eurocode 2/);
  assert.match(BY['bend-diameter'].definition.en, /mandrel/); assert.match(BY['bend-diameter'].definition.en, /separate value/);
  assert.match(BY['carbon-equivalent'].definition.en, /different formulas/);
  assert.match(BY['concrete-slump'].definition.en, /workability is a broader property/);
  assert.match(BY.grade.definition.en, /only within its own standard/);
});

/* ---- search ------------------------------------------------------------------ */
test('search in English, Arabic and Chinese finds the same entry', () => {
  assert.equal(ids('stirrup')[0], 'stirrup');
  assert.equal(ids('الكانة', { lang: 'ar' })[0], 'stirrup');
  assert.equal(ids('箍筋', { lang: 'zh' })[0], 'stirrup');
  assert.equal(ids('Mill test certificate')[0], 'mill-test-certificate');
  assert.equal(ids('شهادة اختبار المصنع', { lang: 'ar' })[0], 'mill-test-certificate');
  assert.equal(ids('质量证明书', { lang: 'zh' })[0], 'mill-test-certificate');
});

test('partial words, case and Arabic normalisation', () => {
  assert.equal(ids('lap')[0], 'lap-splice');
  assert.equal(ids('STIRRUP')[0], 'stirrup');
  assert.equal(ids('Yield')[0], 'yield-strength');
  assert.equal(ids('كانه', { lang: 'ar' })[0], 'stirrup');                 // ة typed as ه
  assert.equal(ids('كَانَة', { lang: 'ar' })[0], 'stirrup');               // diacritics ignored
  assert.equal(ids('اعتماد المواد', { lang: 'ar' })[0], 'material-submittal');
  assert.equal(ids('إعتماد المواد', { lang: 'ar' })[0], 'material-submittal'); // إ typed for ا
  assert.equal(ids('كان', { lang: 'ar' })[0], 'stirrup');                  // part of a word
  assert.equal(ids('坍落', { lang: 'zh' })[0], 'concrete-slump');
  assert.equal(ids('  lap   splice  ')[0], 'lap-splice');
  assert.equal(ids('lap-splice')[0], 'lap-splice');                         // punctuation is a separator
});

test('synonyms, regional names and abbreviations', () => {
  assert.equal(ids('كمرة', { lang: 'ar' })[0], 'beam');
  assert.equal(ids('جسر', { lang: 'ar' })[0], 'beam');
  assert.equal(ids('螺纹钢', { lang: 'zh' })[0], 'deformed-bar');
  assert.equal(ids('MTC')[0], 'mill-test-certificate');
  assert.equal(ids('ncr')[0], 'non-conformance-report');
  assert.equal(ids('rebar')[0], 'reinforcing-steel');
  assert.equal(ids('BBS')[0], 'bar-bending-schedule');
  assert.equal(ids('كانات', { lang: 'ar' })[0], 'stirrup');
  assert.equal(ids('shuttering')[0], 'formwork');
  assert.equal(ids('Gr60')[0], 'grade');                                     // example grade, found through the definition
  // a word that first appears inside a longer word still matches later as a whole word
  assert.equal(ids('طلب شراء', { lang: 'ar' })[0], 'purchase-order');
});

test('search by definition text ranks below name matches', () => {
  const r = ids('protects the steel from corrosion');
  assert.equal(r[0], 'concrete-cover');
  const tensile = D.search(IX, 'tensile', { lang: 'en' }).results;
  const scoreOf = id => tensile.find(x => x.id === id).score;
  assert.ok(scoreOf('tensile-strength') > scoreOf('reinforcing-steel'), 'name match before definition match');
  assert.ok(ids('rust').includes('corrosion'));
  assert.ok(!ids('bar').includes('safety-harness'), '“bar” does not match inside other words of a definition');
});

test('several words must all match', () => {
  const r = ids('stirrup beam');
  assert.ok(r.includes('stirrup') && r.includes('beam'));
  for (const id of r) {
    const t = BY[id], hay = D.norm(JSON.stringify([t.term, t.synonyms, t.definition, t.abbreviation || '']));
    assert.ok(hay.includes('stirrup') && hay.includes('beam'), id);
  }
});

test('category filter, combined with search, and counts per category', () => {
  const all = D.search(IX, '', { lang: 'en' });
  assert.equal(all.total, DATA.terms.length);
  assert.equal(all.results.length, DATA.terms.length);
  const qa = D.search(IX, '', { lang: 'en', category: 'qaqc' });
  assert.equal(qa.results.length, DATA.terms.filter(t => t.category === 'qaqc').length);
  assert.ok(qa.results.every(r => BY[r.id].category === 'qaqc'));
  const c = D.search(IX, 'test', { lang: 'en', category: 'qaqc' });
  assert.ok(c.results.length > 0 && c.results.every(r => BY[r.id].category === 'qaqc'));
  const unfiltered = D.search(IX, 'test', { lang: 'en' });
  assert.equal(c.results.length, unfiltered.counts.qaqc);
  assert.equal(Object.values(unfiltered.counts).reduce((a, b) => a + b, 0), unfiltered.total);
  assert.deepEqual(D.search(IX, 'corrosion', { lang: 'en', category: 'safety' }).results, []);
  // no query: grouped by category in data order
  const cats = all.results.map(r => BY[r.id].category);
  assert.deepEqual([...new Set(cats)], DATA.categories.map(x => x.id));
});

test('no match gives an empty result, not an error', () => {
  for (const q of ['xyzzy', 'كلمةغيرموجودة', '不存在的词', '"<script>"']) {
    const r = D.search(IX, q, { lang: 'en' });
    assert.deepEqual(r.results, []);
    assert.equal(r.total, 0);
  }
  assert.equal(D.search(IX, '   ', { lang: 'en' }).results.length, DATA.terms.length);
  assert.equal(D.tokens('x'.repeat(500))[0].word.length, 100, 'query is capped');
});

test('highlight ranges point at the original text', () => {
  const at = (text, q) => D.highlightRanges(text, q).map(([a, b]) => text.slice(a, b));
  assert.deepEqual(at('Reinforcing steel', 'STEEL'), ['steel']);
  assert.deepEqual(at('الكانة المغلقة', 'كانه'), ['كانة']);
  assert.deepEqual(at('مَقاومة الخضوع', 'مقاومه'), ['مَقاومة']);
  assert.deepEqual(at('钢筋下料表', '下料'), ['下料']);
  assert.deepEqual(at('Lap splice, lap length', 'lap'), ['Lap', 'lap']);
  assert.deepEqual(at('splice lap', 'lap splice'), ['splice lap'], 'adjacent words join into one mark');
  assert.deepEqual(at('lap splice', 'lap splice'), ['lap splice']);
  assert.deepEqual(D.highlightRanges('anything', ''), []);
});

test('copy text: one language or all three on separate lines', () => {
  const t = BY.stirrup;
  assert.equal(D.copyText(t, 'en'), 'Stirrup');
  assert.equal(D.copyText(t, 'ar'), 'الكانة');
  assert.equal(D.copyText(t, 'zh'), '箍筋');
  assert.equal(D.copyText(t, 'all'), 'EN: Stirrup\nAR: الكانة\nZH: 箍筋');
  for (const l of D.LANGS) { assert.equal(typeof TXT[l].copied('x'), 'string'); assert.ok(TXT[l].count(3, 189).includes('3')); }
});

/* ---- pages --------------------------------------------------------------------- */
test('three pages: language, direction, canonical, reciprocal hreflang, equivalent language links', () => {
  for (const [l, u] of Object.entries(PAGES)) {
    const h = read(u);
    assert.match(h, new RegExp(`<html lang="${HL[l]}" dir="${l === 'ar' ? 'rtl' : 'ltr'}">`));
    assert.ok(h.includes(`<link rel="canonical" href="${SITE + u}">`));
    const alts = Object.fromEntries([...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => [m[1], m[2]]));
    assert.deepEqual(alts, { en: SITE + PAGES.en, ar: SITE + PAGES.ar, 'zh-Hans': SITE + PAGES.zh, 'x-default': SITE + PAGES.en });
    for (const o of Object.keys(PAGES)) if (o !== l) assert.ok(h.includes(`href="${PAGES[o]}" hreflang="${HL[o]}"`), `${l} switch to ${o}`);
    const title = h.match(/<title>([^<]+)<\/title>/)[1], desc = h.match(/<meta name="description" content="([^"]+)">/)[1];
    assert.ok(desc.includes(String(DATA.terms.length)), l + ' description states the term count');
    assert.ok(title.length < 100 && desc.length <= 200, l);
    for (const b of h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(b.replace(/<\/?script[^>]*>/g, ''));
    const set = JSON.parse(h.match(/<!--cd:ld--><script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(set['@type'], 'DefinedTermSet');
    assert.equal(set.hasDefinedTerm.length, DATA.terms.length);
  }
  const titles = Object.values(PAGES).map(u => read(u).match(/<title>([^<]+)/)[1]);
  assert.equal(new Set(titles).size, 3);
});

test('static cards match terms.json in every language', () => {
  for (const [l, u] of Object.entries(PAGES)) {
    const h = read(u);
    const cards = [...h.matchAll(/<article class="cd-card" id="t-([a-z0-9-]+)" data-id="\1" data-cat="([a-z]+)"[\s\S]*?<\/article>/g)];
    assert.deepEqual(cards.map(c => c[1]), DATA.terms.map(t => t.id), l + ' card order');
    for (const c of cards) {
      const t = BY[c[1]];
      assert.equal(c[2], t.category);
      for (const x of D.LANGS) {
        const m = c[0].match(new RegExp(`<span class="cd-term" lang="${HL[x]}" dir="${x === 'ar' ? 'rtl' : 'ltr'}" data-f="term" data-l="${x}">([^<]*)</span>`));
        assert.ok(m, `${l} ${t.id} ${x}`);
        assert.equal(unesc(m[1]), t.term[x]);
        assert.ok(c[0].includes(`data-copy="${x}"`));
      }
      assert.ok(unesc(c[0]).includes(t.definition[l]), `${l} ${t.id} definition`);
      assert.equal(c[0].includes('class="cd-review"'), !!t.review, `${l} ${t.id} review badge`);
      for (const r of t.related) assert.ok(c[0].includes(`href="#t-${r}" data-rel="${r}"`), `${l} ${t.id} related ${r}`);
    }
    for (const c of DATA.categories) assert.ok(h.includes(`data-cat="${c.id}" aria-pressed="false">`), `${l} filter ${c.id}`);
  }
});

test('dictionary pages: help links, internal links and anchors resolve', () => {
  for (const [l, u] of Object.entries(PAGES)) {
    const h = read(u), guide = read(HELP[l]);
    assert.ok(h.includes(`<p class="cd-help"><a href="${HELP[l]}" target="_blank" rel="noopener">`), l + ' top help link');
    const ctx = [...h.matchAll(/<a class="cd-q" href="([^"#]+)#([^"]+)" target="_blank" rel="noopener">/g)];
    assert.ok(ctx.length >= 2, l + ' contextual help links');
    for (const [, g, a] of ctx) { assert.equal(g, HELP[l]); assert.ok(guide.includes(`id="${a}"`), `${l} #${a}`); }
    for (const [, href] of h.matchAll(/href="(\/[^"#]*)(?:#[^"]*)?"/g)) {
      if (/^\/(assets|favicon|apple-touch)/.test(href)) continue;
      assert.ok(fs.existsSync(path.join(ROOT, href, href.endsWith('/') ? 'index.html' : '')), `${l} -> ${href}`);
    }
    for (const [, id] of h.matchAll(/href="#([^"]+)"/g)) assert.ok(h.includes(`id="${id}"`), `${l} #${id}`);
    const src = h.match(/data-src="([^"?]+)/)[1];
    assert.ok(fs.existsSync(path.join(ROOT, src)), 'data file');
  }
  // the Help Center and the tools index link to the dictionary
  for (const [l, u] of Object.entries({ en: '/help/', ar: '/ar/help/', zh: '/zh/help/' })) assert.ok(read(u).includes(`href="${HELP[l]}"`) && read(u).includes(`href="${PAGES[l]}"`), l + ' help index');
  assert.ok(read('/tools/').includes('href="/tools/construction-dictionary/"'));
  assert.ok(read('/ar/tools/').includes('href="/ar/tools/construction-dictionary/"'));
  assert.ok(read('/zh/').includes('href="/zh/tools/construction-dictionary/"'));
});

test('safe rendering, no network beyond the local data file, no storage', () => {
  const app = fs.readFileSync(path.join(ROOT, 'assets/construction-dictionary/app.js'), 'utf8');
  const eng = fs.readFileSync(path.join(ROOT, 'assets/construction-dictionary/dictionary.js'), 'utf8');
  for (const [name, src] of [['app.js', app], ['dictionary.js', eng]]) {
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|setAttribute\(['"]on/, name + ' writes no HTML');
    assert.doesNotMatch(src, /XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|document\.cookie|caches\./, name + ' no network or storage');
  }
  assert.equal((app.match(/fetch\(/g) || []).length, 1, 'one fetch');
  assert.ok(app.includes("fetch(url, { credentials: 'same-origin' })") && app.includes("root.getAttribute('data-src')"), 'the fetch is the local data file');
  assert.doesNotMatch(app, /pushState|location\.search|URLSearchParams/, 'the query is not put in the address');
  for (const u of Object.values(PAGES)) {
    const h = read(u);
    assert.deepEqual([...h.matchAll(/<script src="([^"]+)"/g)].map(m => m[1].split('?')[0]),
      ['/assets/site.js', '/assets/construction-dictionary/dictionary.js', '/assets/construction-dictionary/i18n.js', '/assets/construction-dictionary/app.js']);
    assert.doesNotMatch(h, /googletagmanager|gtag\(|analytics|facebook\.net|hotjar|clarity\.ms/i);
    assert.doesNotMatch(h, /<form\b/);
  }
});
