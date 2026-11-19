/* Tests for Steel Weight Verification: assets/swv/engine.js and i18n.js.
   Expected values are worked out by hand in each test (0.006165 x d^2 kg/m),
   independently of the engine. Run: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../assets/swv/engine.js');
const TXT = require('../assets/swv/i18n.js');
const BBS = require('../assets/bbs/engine.js');
const CutOpt = require('../assets/cutopt/engine.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);
const ev = (o) => S.evaluate(Object.assign({ diameter: '16', length: '1000', lengthUnit: 'mm', bars: '1', actualKg: '1.6' }, o));

test('every Al Rajhi size: unit weight and 1 m theoretical weight by hand', () => {
  const hand = { 10: 0.6165, 12: 0.88776, 14: 1.20834, 16: 1.57824, 18: 1.99746, 20: 2.466, 25: 3.853125, 32: 6.31296 };
  assert.deepEqual(S.SIZES, [10, 12, 14, 16, 18, 20, 25, 32]);
  for (const d of S.SIZES) {
    const r = ev({ diameter: String(d), actualKg: '1' });
    assert.equal(r.ok, true);
    near(r.sample.unitWeight, hand[d], 1e-12, 'd=' + d);
    near(r.sample.theoreticalKg, hand[d], 1e-12, 'd=' + d);
    assert.equal(r.sample.standardSize, true);
    assert.deepEqual(r.sample.warnings.filter(w => w === 'nonStandard'), []);
  }
});

test('same nominal formula as the BBS Analyzer and the Cutting Optimizer', () => {
  for (const d of [8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 40]) {
    assert.equal(S.unitWeight(d), BBS.unitWeight(d));
    assert.equal(S.unitWeight(d), CutOpt.massPerMetre(d));
    // the same bars in all three tools give the same theoretical weight
    const v = S.evaluate({ diameter: String(d), length: '12000', lengthUnit: 'mm', bars: '7', actualKg: '1' }).sample.theoreticalKg;
    const g = [['Dia', 'Grade', 'Cut length (mm)', 'Qty'], [d, 'Gr60', 12000, 7]];
    const det = BBS.detectHeader(g);
    near(BBS.analyze(g, { headerRow: det.headerRow, mapping: det.mapping, units: det.units }).summary.totals.weightKg, v, 1e-9);
    near(CutOpt.optimize({ stockLength: 12000, kerf: 0, items: [{ diameter: d, grade: 'Gr60', length: 12000, qty: 7 }] }).groups[0].weightRequiredKg, v, 1e-9);
  }
});

test('lengths in mm and m, and several bars', () => {
  const a = ev({ length: '500', lengthUnit: 'mm', bars: '3', actualKg: '2.4' });
  near(a.sample.theoreticalKg, 1.57824 * 0.5 * 3, 1e-12);
  near(a.sample.theoreticalPerBarKg, 1.57824 * 0.5, 1e-12);
  const b = ev({ length: '0.5', lengthUnit: 'm', bars: '3', actualKg: '2.4' });
  near(b.sample.theoreticalKg, a.sample.theoreticalKg, 1e-12);
  assert.equal(b.sample.lengthMm, 500);
  const c = ev({ diameter: '25', length: '12', lengthUnit: 'm', bars: '10', actualKg: '460' });
  near(c.sample.theoreticalKg, 3.853125 * 120, 1e-9);                 // 462.375 kg
  near(c.sample.actualPerMetreKg, 460 / 120, 1e-12);
});

test('deviation sign: positive above theoretical, negative below, zero equal', () => {
  const up = ev({ actualKg: '1.65' });
  near(up.sample.differenceKg, 1.65 - 1.57824, 1e-12);
  near(up.sample.deviationPct, (1.65 - 1.57824) / 1.57824 * 100, 1e-10);
  assert.ok(up.sample.deviationPct > 0);
  const down = ev({ actualKg: '1.5' });
  near(down.sample.deviationPct, (1.5 - 1.57824) / 1.57824 * 100, 1e-10);   // -4.957...
  assert.ok(down.sample.deviationPct < 0);
  const eq = ev({ diameter: '20', actualKg: '2.466' });
  near(eq.sample.deviationPct, 0, 1e-10);
});

test('decimal precision: computed unrounded, no float drift from inputs', () => {
  const r = ev({ diameter: '12', length: '0.3', lengthUnit: 'm', bars: '1', actualKg: '0.27' });
  near(r.sample.theoreticalKg, 0.88776 * 0.3, 1e-15);                  // 0.266328
  near(r.sample.deviationPct, (0.27 - 0.266328) / 0.266328 * 100, 1e-9); // 1.378...
  const t = ev({ diameter: '10', length: '1000', bars: '1', actualKg: '0.6165' });
  assert.ok(Math.abs(t.sample.deviationPct) < 1e-12);
});

test('zero, negative and invalid inputs are refused with a reason', () => {
  const cases = [
    [{ diameter: '' }, 'diaMissing'], [{ diameter: 'T16' }, 'diaInvalid'], [{ diameter: '70' }, 'diaRange'], [{ diameter: '0' }, 'diaRange'],
    [{ lengthUnit: 'cm' }, 'unit'], [{ length: '' }, 'lenMissing'], [{ length: '1,5', lengthUnit: 'm' }, 'lenComma'], [{ length: 'abc' }, 'lenInvalid'],
    [{ length: '0' }, 'lenNotPositive'], [{ length: '-500' }, 'lenNotPositive'], [{ length: '13000' }, 'lenOverStock'],
    [{ length: '500', lengthUnit: 'm' }, 'unitLooksMm'], [{ length: '1.5', lengthUnit: 'mm' }, 'unitLooksM'],
    [{ bars: '' }, 'barsMissing'], [{ bars: 'x' }, 'barsInvalid'], [{ bars: '1.5' }, 'barsFraction'], [{ bars: '0' }, 'barsRange'], [{ bars: '1001' }, 'barsRange'],
    [{ actualKg: '' }, 'kgMissing'], [{ actualKg: '1,6' }, 'kgComma'], [{ actualKg: '1e2' }, 'kgInvalid'], [{ actualKg: '0' }, 'kgNotPositive'],
    [{ actualKg: '-1' }, 'kgNotPositive'], [{ actualKg: '100001' }, 'kgRange']];
  for (const [o, code] of cases) {
    const r = ev(o);
    assert.equal(r.ok, false, JSON.stringify(o));
    assert.ok(r.errors.includes(code), JSON.stringify(o) + ' -> ' + r.errors);
    for (const l of ['en', 'ar', 'zh']) assert.ok(TXT[l].err[code], l + ' ' + code);
  }
});

test('non-standard sizes are calculated and marked; very large gaps ask for a re-check', () => {
  const r = ev({ diameter: '22', actualKg: '3' });
  assert.equal(r.ok, true);
  assert.equal(r.sample.standardSize, false);
  assert.ok(r.sample.warnings.includes('nonStandard'));
  near(r.sample.unitWeight, 0.006165 * 484, 1e-12);
  assert.ok(ev({ actualKg: '2.5' }).sample.warnings.includes('largeDeviation'));
  assert.ok(!ev({ actualKg: '1.6' }).sample.warnings.includes('largeDeviation'));
});

test('grade is informational and never changes the nominal weight', () => {
  const a = ev({ grade: 'Gr60' }).sample, b = ev({ grade: 'Gr80' }).sample, c = ev({ grade: '' }).sample;
  assert.equal(a.theoreticalKg, b.theoreticalKg);
  assert.equal(a.theoreticalKg, c.theoreticalKg);
  assert.equal(b.grade, 'Gr80');
});

test('user-defined tolerance: inclusive bounds, one-sided ranges, invalid ranges', () => {
  const t = S.readTolerance('-5', '5');
  assert.deepEqual(t, { ok: true, tol: { lower: -5, upper: 5 } });
  assert.equal(S.compare(-5, t.tol), 'inside');
  assert.equal(S.compare(5, t.tol), 'inside');
  assert.equal(S.compare(-5.000001, t.tol), 'outside');
  assert.equal(S.compare(5.0001, t.tol), 'outside');
  assert.equal(S.compare(0, t.tol), 'inside');
  const lowOnly = S.readTolerance('-3.5', '');
  assert.equal(S.compare(40, lowOnly.tol), 'inside');
  assert.equal(S.compare(-3.6, lowOnly.tol), 'outside');
  assert.deepEqual(S.readTolerance('', ''), { ok: true, tol: null });
  assert.equal(S.compare(-50, null), null);                              // no range: no statement at all
  assert.deepEqual(S.readTolerance('5', '-5').errors, ['tolLowerSign', 'tolUpperSign']);
  assert.deepEqual(S.readTolerance('x', '6').errors, ['tolLowerInvalid']);
  assert.deepEqual(S.readTolerance('-200', '').errors, ['tolRange']);
  // the comparison uses the unrounded deviation, not the displayed one
  const s = ev({ actualKg: String(1.57824 * 1.05 + 1e-9) }).sample;
  assert.equal(S.compare(s.deviationPct, t.tol), 'outside');
});

test('no built-in limit: without a range a sample is never classified', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'swv', 'engine.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  // no verdict words and no standard limits in the code; the only mention of
  // compliance is the CSV note saying the comparison is NOT a compliance decision
  assert.doesNotMatch(src, /\bcompliant\b|non-compliant|\bpass(es|ed)?\b|\bfail(s|ed)?\b|ASTM|A615/i);
  assert.deepEqual(src.match(/complian\w*/gi), ['compliance']);
  assert.match(src, /not a compliance decision/);
  for (const l of ['en', 'ar', 'zh']) {
    const all = JSON.stringify(TXT[l], (k, v) => typeof v === 'function' ? v.toString() : v);
    assert.doesNotMatch(all, /\b(complies|compliant|non-compliant|passes|fails)\b/i);
  }
});

test('multiple samples: pooled only within a diameter, extremes kept, no cross-diameter %', () => {
  const s = [ev({ ref: 'A', actualKg: '1.60' }), ev({ ref: 'B', actualKg: '1.50' }), ev({ ref: 'C', length: '2000', actualKg: '3.20' }),
             ev({ ref: 'D', diameter: '12', actualKg: '0.90' })].map(r => r.sample);
  const sum = S.summarise(s);
  assert.deepEqual(sum.byDiameter.map(g => [g.diameter, g.samples, g.bars]), [[12, 1, 1], [16, 3, 3]]);
  const g16 = sum.byDiameter[1];
  near(g16.theoreticalKg, 1.57824 * 4, 1e-12);
  near(g16.actualKg, 6.3, 1e-12);
  near(g16.deviationPct, (6.3 - 6.31296) / 6.31296 * 100, 1e-10);
  near(g16.minDev, (1.5 - 1.57824) / 1.57824 * 100, 1e-10);
  near(g16.maxDev, (3.2 - 3.15648) / 3.15648 * 100, 1e-10);
  near(g16.lengthM, 4, 1e-12);
  assert.equal(sum.totals.samples, 4);
  near(sum.totals.theoreticalKg, 1.57824 * 4 + 0.88776, 1e-12);
  assert.equal(sum.totals.deviationPct, null);                           // two diameters: no single %
  assert.equal(sum.totals.diameters, 2);
  const one = S.summarise(s.slice(0, 3));
  near(one.totals.deviationPct, g16.deviationPct, 1e-12);                // one diameter: same as the pooled value
});

test('CSV export: header, values, injection-safe text, statement', () => {
  const s = [ev({ ref: '=HYPERLINK("x")', notes: '+cmd', actualKg: '1.6' }).sample, ev({ ref: 'B', diameter: '12', actualKg: '0.9' }).sample];
  const table = S.csvTable(s, { lower: -5, upper: 5 });
  assert.equal(table[0][0], 'Reference');
  assert.equal(table[1][0], '=HYPERLINK("x")');                          // raw in the table...
  const csv = S.toCsv(table);
  assert.ok(csv.startsWith('﻿'));
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);                           // ...neutralised in the file
  assert.match(csv, /,'\+cmd\r\n/);
  assert.match(csv, /,1\.379,inside,/);                                  // (1.6-1.57824)/1.57824 = 1.3787%
  assert.match(csv, /Not a mill test certificate \(MTC\)/);
  assert.match(csv, /same for Grade 60 and Grade 80/);
  assert.equal(S.csvCell(-4.5), '-4.5');
  assert.equal(S.csvCell('@x'), "'@x");
});

test('text fields are cleaned and limited', () => {
  const r = ev({ ref: 'a\u0000b\nc' + 'x'.repeat(100), notes: 'n'.repeat(400) }).sample;
  assert.equal(r.ref.length, 60);
  assert.doesNotMatch(r.ref, /[\u0000\n]/);
  assert.equal(r.notes.length, 300);
});

test('English, Arabic and Chinese have the same interface keys', () => {
  const shape = o => typeof o === 'function' ? 'fn' : Array.isArray(o) ? 'array' : (o && typeof o === 'object') ? Object.fromEntries(Object.keys(o).sort().map(k => [k, shape(o[k])])) : typeof o;
  assert.deepEqual(shape(TXT.ar), shape(TXT.en));
  assert.deepEqual(shape(TXT.zh), shape(TXT.en));
  for (const l of ['en', 'ar', 'zh']) {
    assert.match(TXT[l].sumFoot, /0\.006165/);
    assert.match(TXT[l].rangeNote(-5, 5), /-5/);
    assert.match(TXT[l].warn.nonStandard, /10.*12.*14.*16.*18.*20.*25.*32/);
  }
});

test('privacy: no network, storage or HTML-injection APIs', () => {
  for (const f of ['engine.js', 'i18n.js', 'app.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'swv', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const bad of [/\bfetch\s*\(/, /XMLHttpRequest/, /localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /sendBeacon/,
      /\.innerHTML/, /outerHTML/, /insertAdjacentHTML/, /\beval\s*\(/, /new Function/, /WebSocket/]) assert.doesNotMatch(src, bad, f + ' ' + bad);
  }
  const app = fs.readFileSync(path.join(__dirname, '..', 'assets', 'swv', 'app.js'), 'utf8');
  assert.match(app, /if \(!window\.confirm\(T\.confirmWa\)\) return;\s*copy/);  // WhatsApp only after confirmation
});
