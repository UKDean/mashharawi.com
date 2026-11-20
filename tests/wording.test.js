/* Commercial wording guard. The approved supply wording (Nov 2026) is
   "supply after payment confirmation or LC approval, subject to company
   procedures, product availability and the agreed delivery schedule", with
   cutting to specified lengths subject to confirmation. Promises of
   immediate delivery must not come back in any language, including notes
   scheduled for later publication. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['.git', 'node_modules', 'motion', 'tests', '.github', 'docs']);
const EXT = new Set(['.html', '.md', '.txt', '.py', '.js']);
function files(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) files(p, out); }
    else if (EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
}
// The dictionary defines first aid as "immediate care"; that is not a supply claim.
const ALLOW = [/construction-dictionary/, /contract-check/];
const BANNED = [
  /immediate delivery/i, /delivery is immediate/i, /immediate after payment/i,
  /تسليم فوري/, /التسليم فوري/, /التسليم فورياً/, /فوري بعد الدفع/,
  /即时交货/, /即可交货/, /立即交货/, /交货快/,
];

test('no file promises immediate delivery', () => {
  const hits = [];
  for (const f of files()) {
    const rel = path.relative(ROOT, f);
    if (ALLOW.some((r) => r.test(rel))) continue;
    const t = fs.readFileSync(f, 'utf8');
    for (const re of BANNED) if (re.test(t)) hits.push(rel + ' ' + re);
  }
  assert.deepEqual(hits, []);
});

test('every supply list (q-facts) carries the approved supply line for its language', () => {
  const approved = {
    en: 'Supply after payment confirmation or LC approval, subject to company procedures, product availability and the agreed delivery schedule',
    ar: 'التوريد بعد تأكيد الدفع أو اعتماد الاعتماد المستندي (LC)، وفق إجراءات الشركة وتوفر المنتج وجدول التسليم المتفق عليه',
    zh: '付款确认或信用证（LC）批准后安排供货，须符合公司流程、产品库存情况及约定的交货计划',
  };
  let lists = 0;
  for (const f of files()) {
    if (!f.endsWith('.html') && !f.endsWith('build_notes.py')) continue;
    const t = fs.readFileSync(f, 'utf8');
    for (const m of t.matchAll(/<ul class="q-facts">([\s\S]*?)<\/ul>/g)) {
      lists++;
      const body = m[1];
      const lang = /[؀-ۿ]/.test(body) ? 'ar' : /[一-鿿]/.test(body) ? 'zh' : 'en';
      assert.ok(body.includes(approved[lang]), `${path.relative(ROOT, f)}: supply list without the approved ${lang} line`);
    }
  }
  assert.ok(lists >= 30, `expected the supply list on many pages, found ${lists}`);
});
