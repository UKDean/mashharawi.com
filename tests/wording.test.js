/* Commercial wording guard.

   The approved supply wording (Nov 2026) is "supply after payment
   confirmation or LC approval, subject to company procedures, product
   availability and the agreed delivery schedule", with cutting to specified
   lengths subject to confirmation. No page, article, scheduled post or
   generator may promise a delivery time: immediate delivery, delivery within
   N hours/days, same-day or next-day delivery, stock ready to ship, in any of
   English, Arabic or Simplified Chinese.

   findDeliveryClaims() looks for a delivery word (deliver/ship/supply,
   تسليم/توريد/شحن, 交货/发货/供货 …) tied to a timing promise, plus a few
   phrases that are promises on their own (现货, ready stock). Requiring the
   delivery word keeps calculator text such as "instant calculation", "the
   quick method" or "即可询价" out of it. The fixtures below pin both sides. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// ---------- detector ----------
// Arabic: drop harakat, tanween, shadda, superscript alef and tatweel, and
// unify alef forms, so نسلّم / نسلم and فوراً / فورا / فورًا match the same rule.
function normArabic(s) {
  return s.replace(/[ؐ-ًؚ-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا');
}
const EN_DEL = String.raw`(?:deliver(?:y|ies|ed|s|ing)?|dispatch(?:ed|es|ing)?|ship(?:ped|ping|ment|ments|s)?|suppl(?:y|ied|ies))`;
const EN_NOW = String.raw`(?:immediate(?:ly)?|instant(?:ly)?|right away|at once|without delay|straight away)`;
const EN_SPAN = String.raw`(?:hours?|hrs?|days?|working days|business days)`;
const EN_NUM = String.raw`(?:\d+|one|two|three|four|five|six|seven|ten|twenty-four|forty-eight)`;
const EN = [
  new RegExp(String.raw`\b${EN_NOW}\s+${EN_DEL}\b`, 'i'),                                  // immediate delivery
  new RegExp(String.raw`\b${EN_DEL}\b[^.<\n]{0,30}?\b${EN_NOW}\b`, 'i'),                  // delivered immediately, delivery is immediate
  new RegExp(String.raw`\b(?:same|next)[- ]day\s+${EN_DEL}\b`, 'i'),                       // same-day delivery
  new RegExp(String.raw`\b${EN_DEL}\b[^.<\n]{0,40}?\bwithin\s+${EN_NUM}[\s-]*${EN_SPAN}\b`, 'i'), // delivery within 24 hours
  new RegExp(String.raw`\bwithin\s+${EN_NUM}[\s-]*${EN_SPAN}\b[^.<\n]{0,30}?\b${EN_DEL}\b`, 'i'), // within 2 days of order, delivered
  new RegExp(String.raw`\b(?:prompt|fast|quick|express|rapid|speedy)\s+${EN_DEL}\b`, 'i'), // fast delivery
  /\b(?:ready|ex)[- ]stock\b|\bin stock\b|\bavailable from stock\b/i,                      // stock ready to ship
];
const AR_DEL = '(?:تسليم|التسليم|توريد|التوريد|شحن|الشحن|توصيل|التوصيل|نسلم|نورد|نشحن|نوصل|يسلم|يورد|يشحن|تسلم|تورد|تشحن)';
const AR_NOW = '(?:فوري|فوريا|فورا|على الفور|في الحال|حالا|بشكل فوري)';
const AR = [
  new RegExp(`${AR_DEL}[^.\\n<]{0,25}?${AR_NOW}`),                                           // تسليم فوري، التسليم يكون فوريا، نسلم فورا، توريد فوري
  new RegExp(`${AR_NOW}[^.\\n<]{0,6}?${AR_DEL}`),                                            // فورا نسلم
  new RegExp(`${AR_DEL}[^.\\n<]{0,30}?(?:خلال|في غضون|في مدة لا تتجاوز)\\s*[0-9٠-٩]+\\s*(?:ساعة|ساعات|ساعه|يوم|يوما|ايام)`), // التسليم خلال 24 ساعة
  new RegExp(`${AR_DEL}[^.\\n<]{0,20}?(?:في نفس اليوم|في اليوم نفسه|في اليوم التالي)`),        // الشحن في نفس اليوم
  new RegExp(`${AR_DEL}\\s+(?:سريع|عاجل)`),                                                  // تسليم سريع
  /(?:جاهز|جاهزة|متوفر|متوفرة)\s+(?:في المخزون|من المخزون|للتسليم الفوري)|من المخزون مباشرة/,
];
const ZH_DEL = '(?:交货|发货|供货|送货|配送|出货|到货|交付|送达)';
const ZH = [
  new RegExp(`(?:立即|立刻|马上|即时|即刻|当天|当日|次日|隔日|即可)\\s*${ZH_DEL}`),          // 立即发货, 即时交货, 当天发货, 即可交货
  /现货/,                                                                                  // goods in stock
  new RegExp(`(?:\\d+|[一二两三四五六七八九十]+)\\s*个?\\s*(?:小时|天|日|工作日)\\s*(?:内|之内)\\s*(?:即可|可)?\\s*${ZH_DEL}`), // 24小时内发货
  new RegExp(`${ZH_DEL}\\s*(?:快|迅速)|(?:快速|极速|闪电)\\s*${ZH_DEL}`),                   // 交货快, 快速发货
];

function findDeliveryClaims(text) {
  const hits = [];
  text.split('\n').forEach((raw, i) => {
    const line = normArabic(raw);
    for (const re of [...EN, ...AR, ...ZH]) {
      const m = line.match(re);
      if (m) hits.push({ line: i + 1, match: m[0] });
    }
  });
  return hits;
}

// ---------- fixtures ----------
const MUST_CATCH = [
  'Immediate delivery after payment or LC.', 'Delivered immediately after payment.', 'Delivery is immediate once the LC is opened.',
  'Delivery within 24 hours of payment.', 'We ship within 2 days.', 'Same-day delivery in Riyadh.', 'Next-day dispatch.',
  'Ready stock, prompt delivery.', 'All sizes in stock.', 'Fast delivery across the Kingdom.', 'Supplied instantly.',
  'تسليم فوري بعد الدفع', 'توريد فوري لجميع المقاسات', 'التسليم يكون فورياً بعد فتح الاعتماد', 'التسليم يكون فوريًا',
  'نسلّم فوراً بعد الدفع', 'فوراً نسلّم الطلب', 'التسليم خلال 24 ساعة', 'التوريد خلال ٤٨ ساعة', 'الشحن في نفس اليوم',
  'تسليم سريع', 'متوفر في المخزون', 'نورّد على الفور',
  '付款后即时交货', '付款后立即发货', '马上交货', '现货供应', '当天发货', '24小时内发货', '三天内交货', '交货快', '快速发货', '即可交货',
];
const MUST_PASS = [
  // the approved wording itself
  'Supply after payment confirmation or LC approval, subject to company procedures, product availability and the agreed delivery schedule.',
  'التوريد بعد تأكيد الدفع أو اعتماد الاعتماد المستندي (LC)، وفق إجراءات الشركة وتوفر المنتج وجدول التسليم المتفق عليه',
  '付款确认或信用证（LC）批准后安排供货，须符合公司流程、产品库存情况及约定的交货计划',
  // calculator and processing language, and text that already appears on the site
  'Instant calculation in your browser.', 'Fast processing of large schedules.', 'No. The tools work immediately, without registration.',
  '// hero shows immediately on load', 'Use the quick method for pipes.', 'The standard stock length is 12 m.',
  'cut with a shear, never a torch, and coat the end the same day.',
  'الطريقة السريعة', 'جدول سريع ومثال محلول', 'للحصول على تقرير فوري بالعربية', 'قائمة فحص سريعة للموقع',
  'إلى الاستشاري خلال 60 يوماً من حدوث ارتفاع الأسعار', 'الدفع المباشر أو الاعتماد المستندي', 'هل السعر تسليم المصنع أم تسليم الموقع؟',
  'الشحن متاح لجميع مناطق المملكة، والمسافة جزء من التكلفة.', 'مدينة المشروع وموقع التسليم',
  '发送规格、吨位或钢筋下料单即可询价', '立即计算', '点击即可跳到对应字段', '约定的交货计划', '产品库存情况',
];

test('detector catches immediate-delivery claims in English, Arabic and Chinese', () => {
  const missed = MUST_CATCH.filter((s) => findDeliveryClaims(s).length === 0);
  assert.deepEqual(missed, [], 'not detected');
});

test('detector ignores calculator text, processing speed and the approved wording', () => {
  const flagged = MUST_PASS.map((s) => [s, findDeliveryClaims(s)]).filter(([, h]) => h.length);
  assert.deepEqual(flagged.map(([s, h]) => s + ' -> ' + h[0].match), []);
});

// ---------- repository scan ----------
const { isLocalOnly } = require('./local-only');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'motion', 'tests', 'vendor', '.claude']);
const EXT = new Set(['.html', '.md', '.txt', '.xml', '.py', '.js', '.json']);
// Not sales copy: the dictionary defines terms (first aid is "immediate care"),
// and the contract checker quotes customers' clauses for internal review.
const NOT_SALES_COPY = [/^assets\/construction-dictionary\//, /^(?:ar\/|zh\/)?tools\/construction-dictionary\//, /^contract-check\//];
function walk(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !isLocalOnly(p)) walk(p, out); }
    else if (EXT.has(path.extname(e.name))) out.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
  return out;
}
const FILES = walk().filter((f) => !NOT_SALES_COPY.some((r) => r.test(f)));
const SCHEDULED = FILES.filter((f) => f.startsWith('notes/scheduled/'));
const PUBLISHED = FILES.filter((f) => !f.startsWith('notes/scheduled/'));
const scan = (files) => files.flatMap((f) => findDeliveryClaims(fs.readFileSync(path.join(ROOT, f), 'utf8'))
  .map((h) => `${f}:${h.line}: "${h.match}"`));

test('no published page, article, generator or data file promises a delivery time', () => {
  for (const must of ['index.html', 'rebar/index.html', 'ar/rebar/index.html', 'zh/rebar/index.html', 'llms.txt', 'feed.xml', 'scripts/build_notes.py']) {
    assert.ok(PUBLISHED.includes(must), `${must} is not scanned`);
  }
  assert.ok(PUBLISHED.some((f) => f.startsWith('writing/')) && PUBLISHED.some((f) => /^notes\/[^/]+\.md$/.test(f)), 'articles not scanned');
  assert.deepEqual(scan(PUBLISHED), []);
});

test('no scheduled post promises a delivery time', () => {
  assert.ok(SCHEDULED.length >= 5, `expected scheduled posts, found ${SCHEDULED.length}`);
  assert.deepEqual(scan(SCHEDULED), []);
});

test('every supply list (q-facts) carries the approved supply line for its language', () => {
  const approved = {
    en: 'Supply after payment confirmation or LC approval, subject to company procedures, product availability and the agreed delivery schedule',
    ar: 'التوريد بعد تأكيد الدفع أو اعتماد الاعتماد المستندي (LC)، وفق إجراءات الشركة وتوفر المنتج وجدول التسليم المتفق عليه',
    zh: '付款确认或信用证（LC）批准后安排供货，须符合公司流程、产品库存情况及约定的交货计划',
  };
  let lists = 0;
  for (const f of FILES) {
    if (!f.endsWith('.html') && f !== 'scripts/build_notes.py') continue;
    const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of t.matchAll(/<ul class="q-facts">([\s\S]*?)<\/ul>/g)) {
      lists++;
      const body = m[1];
      const lang = /[؀-ۿ]/.test(body) ? 'ar' : /[一-鿿]/.test(body) ? 'zh' : 'en';
      assert.ok(body.includes(approved[lang]), `${f}: supply list without the approved ${lang} line`);
    }
  }
  assert.ok(lists >= 30, `expected the supply list on many pages, found ${lists}`);
});

// ---------- Chinese cutting service: always subject to confirmation ----------
// A sentence that offers cutting (可按…切割, 我们可以按…切割, 提供…切割,
// 按所需尺寸切割 …) must carry 须经确认 / 经确认后 in the same sentence.
// Questions (吗/？/是否) and general advice that does not offer the service
// (钢厂按单切割, 按下料单在工厂切割可以减少涂层损伤) are not offers.
const ZH_CUT_OFFER = /(?:可按|可以按|我们可以按|可提供|提供|支持)[^。；，？]{0,14}(?:切割|切好)|按(?:所需|指定)?(?:尺寸|长度)切(?:割|好)/;
const ZH_CONFIRMED = /须经确认|经确认后|须经过确认/;
function findUnconditionalCuttingZh(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const unit of line.split(/[。！\n<>"]/)) {
      if (!ZH_CUT_OFFER.test(unit)) continue;
      if (/[？?]|吗|是否/.test(unit)) continue;
      if (!ZH_CONFIRMED.test(unit)) hits.push({ line: i + 1, match: unit.trim().slice(0, 60) });
    }
  });
  return hits;
}
const ZH_CUT_FLAG = [
  '10–32 毫米，12 米定尺，可按钢筋下料单切割，可提供环氧涂层钢筋。',
  '"description": "10–32毫米钢筋，12米定尺，Grade 60 / Grade 80，可按下料单切割，可提供环氧涂层钢筋"',
  '我们可以按您的钢筋下料单或所需长度切割钢筋，规格 10–32 毫米。',
  '<div><dt>切割</dt><dd>按所需尺寸切割（可按钢筋下料单）</dd></div>',
  '<div><dt>切割</dt><dd>可按所需尺寸或钢筋下料单切割</dd></div>',
  '可以按钢筋下料单在工厂切割，减少现场切割造成的涂层损伤。',
  '提供按尺寸切割和环氧涂层。',
  '把钢筋下料单（BBS）发给钢厂，按尺寸切割、按编号打捆送到现场。',
];
const ZH_CUT_OK = [
  '10–32 毫米，12 米定尺，可按钢筋下料单切割（须经确认），可提供环氧涂层钢筋。',
  '<div><dt>切割</dt><dd>按所需尺寸切割（可按钢筋下料单），须经确认</dd></div>',
  '把钢筋下料单（BBS）发给钢厂，经确认后按尺寸切割、按编号打捆送到现场。',
  '<li>按指定长度切割，须经确认</li>', '可以，按指定长度切割须经确认。', '可以，但按指定长度切割须经确认。',
  '<div><dt>切割</dt><dd>可按所需尺寸或钢筋下料单切割，须经确认</dd></div>',
  '环氧涂层钢筋可以切割吗？', '<li><strong>加工要求：</strong>是否需要按尺寸切割，是否需要环氧涂层。</li>',
  '按钢筋下料单在工厂切割，可以减少现场切割造成的涂层损伤。', '建议由项目的钢筋工程师出具下料单，钢厂按单切割。',
  '<li>按钢筋下料单（BBS）切割和弯曲。</li>', '沙特钢筋供应、切割加工与重量计算的中文资料。',
];

test('Chinese cutting check flags unconditional offers and accepts confirmed ones, questions and advice', () => {
  assert.deepEqual(ZH_CUT_FLAG.filter((s) => findUnconditionalCuttingZh(s).length === 0), [], 'offers not flagged');
  assert.deepEqual(ZH_CUT_OK.filter((s) => findUnconditionalCuttingZh(s).length > 0), [], 'wrongly flagged');
});

test('every Chinese offer of cutting on the site, in articles and in scheduled posts is subject to confirmation', () => {
  const hits = FILES.filter((f) => /\.(html|md|txt|xml|json|js|py)$/.test(f))
    .flatMap((f) => findUnconditionalCuttingZh(fs.readFileSync(path.join(ROOT, f), 'utf8')).map((h) => `${f}:${h.line}: ${h.match}`));
  assert.deepEqual(hits, []);
});

// ---------- Chinese certificate claim: withdrawn wording ----------
// "全部检验证书齐全" (all inspection certificates complete) was withdrawn from every
// Chinese page; the approved claim is 可提供所订规格和牌号的钢厂质量证明书（MTC）.
// Two pages written from an old template brought it back once (PR #27).
// Scans every published file, scheduled posts and the page generator included;
// local-only folders (worktrees, backups, research reports) are not published.
const ZH_CERT_WITHDRAWN = /全部\s*检验\s*证书\s*齐全/;
test('certificate check flags the withdrawn phrase and accepts the approved MTC wording', () => {
  for (const s of ['10–32 毫米，可提供环氧涂层钢筋，全部检验证书齐全。', '"text": "全部检验证书 齐全"', '<p>发货至沙特全境，全部 检验证书齐全。</p>']) {
    assert.ok(ZH_CERT_WITHDRAWN.test(s), 'not flagged: ' + s);
  }
  for (const s of ['可提供所订规格和牌号的钢厂质量证明书（MTC）。', '每批到货还要有覆盖车上所有炉号的出厂质量证明书（MTC）', '能提供检测证书吗？']) {
    assert.ok(!ZH_CERT_WITHDRAWN.test(s), 'wrongly flagged: ' + s);
  }
});

test('no published page, scheduled post or generator says 全部检验证书齐全', () => {
  const files = walk();
  const zhPages = files.filter((f) => /^zh\/.+\.html$/.test(f));
  assert.ok(zhPages.length >= 20, `only ${zhPages.length} Chinese pages scanned`);
  for (const must of ['zh/rebar/index.html', 'zh/rebar-site-inspection/index.html', 'zh/rebar-size-substitution-saudi/index.html', 'scripts/build_notes.py', 'llms.txt']) {
    assert.ok(files.includes(must), `${must} is not scanned`);
  }
  const hits = files.flatMap((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')
    .map((line, i) => (ZH_CERT_WITHDRAWN.test(line) ? `${f}:${i + 1}` : null)).filter(Boolean));
  assert.deepEqual(hits, []);
});

// ---------- English supply page metadata ----------
test('rebar page description, Open Graph and JSON-LD carry the same short supply terms', () => {
  const t = fs.readFileSync(path.join(ROOT, 'rebar/index.html'), 'utf8');
  const meta = (t.match(/<meta name="description" content="([^"]+)"/) || [])[1];
  const og = (t.match(/<meta property="og:description" content="([^"]+)"/) || [])[1];
  const ld = [...t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1])).find((d) => d['@type'] === 'WebPage' || d.url === 'https://mashharawi.com/rebar/');
  assert.ok(meta && og && ld, 'description, og:description and JSON-LD WebPage present');
  assert.equal(og, meta);
  assert.equal(ld.description, meta);
  for (const c of ['payment confirmation or LC approval', 'company procedures', 'product availability', 'the agreed delivery schedule']) {
    assert.ok(meta.includes(c), `description lacks "${c}"`);
  }
  assert.ok(meta.length <= 170, `description is ${meta.length} characters`);
});

module.exports = { findDeliveryClaims, findUnconditionalCuttingZh };
