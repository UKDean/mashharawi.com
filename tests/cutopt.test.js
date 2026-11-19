/* Tests for assets/cutopt/engine.js. Run with:  node --test tests/
   No dependencies: Node's built-in test runner and assert. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const CutOpt = require('../assets/cutopt/engine.js');

const base = { stockLength: 12000, kerf: 0, allowance: 0, minOffcut: 0 };
const job = (items, extra) => Object.assign({}, base, extra || {}, { items });

const { checkPlan, exactBars } = require('./helpers.js');

test('nominal mass matches the site weight calculator', () => {
  assert.equal(CutOpt.massPerMetre(16).toFixed(3), '1.578');
  assert.equal(CutOpt.massPerMetre(32).toFixed(3), '6.313');
  assert.equal(CutOpt.massPerMetre(10).toFixed(3), '0.617');
});

test('metres to millimetres, comma or dot, no float drift', () => {
  assert.equal(CutOpt.metresToMm('3.45'), 3450);
  assert.equal(CutOpt.metresToMm('2,875'), 2875);
  assert.equal(CutOpt.metresToMm(0.1 + 0.2), 300);
  assert.ok(Number.isNaN(CutOpt.metresToMm('')));
  assert.ok(Number.isNaN(CutOpt.metresToMm('abc')));
});

test('exact fit: 4 m pieces fill 12 m bars with zero waste', () => {
  const input = job([{ diameter: 16, grade: 'Gr60', length: 4000, qty: 30 }]);
  const r = CutOpt.optimize(input);
  checkPlan(input, r);
  const g = r.groups[0];
  assert.equal(g.bars, 10);
  assert.equal(g.wasteLength, 0);
  assert.equal(g.optimal, true);
  assert.equal(g.patterns.length, 1);
  assert.deepEqual(g.patterns[0].cuts, [4000, 4000, 4000]);
});

test('kerf: three 4 m pieces no longer fit one 12 m bar', () => {
  const input = job([{ diameter: 12, grade: '', length: 4000, qty: 3 }], { kerf: 3 });
  const r = CutOpt.optimize(input);
  checkPlan(input, r);
  assert.equal(r.groups[0].bars, 2);
});

test('kerf: last piece ending at the bar end needs no cut', () => {
  // 3 x 3998 + 2 cuts of 3 = 12000 exactly
  const input = job([{ diameter: 12, grade: '', length: 3998, qty: 3 }], { kerf: 3 });
  const r = CutOpt.optimize(input);
  checkPlan(input, r);
  assert.equal(r.groups[0].bars, 1);
  assert.equal(r.groups[0].patterns[0].kerf, 6);
  assert.equal(r.groups[0].patterns[0].offcut, 0);
});

test('different diameters and grades are never mixed', () => {
  const input = job([
    { diameter: 16, grade: 'Gr60', length: 6000, qty: 1 },
    { diameter: 16, grade: 'Gr80', length: 6000, qty: 1 },
    { diameter: 20, grade: 'Gr60', length: 6000, qty: 1 }
  ]);
  const r = CutOpt.optimize(input);
  checkPlan(input, r);
  assert.equal(r.groups.length, 3);
  assert.equal(r.totals.bars, 3);
  r.groups.forEach(g => assert.equal(g.patterns[0].cuts.length, 1));
});

test('grade matching ignores case and spaces at the ends', () => {
  const input = job([
    { diameter: 16, grade: 'gr60 ', length: 6000, qty: 1 },
    { diameter: 16, grade: 'GR60', length: 6000, qty: 1 }
  ]);
  const r = CutOpt.optimize(input);
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0].bars, 1);
});

test('reusable offcuts are listed, scrap is not', () => {
  const input = job([{ diameter: 20, grade: '', length: 9000, qty: 2 }], { minOffcut: 1000 });
  const r = CutOpt.optimize(input);
  checkPlan(input, r);
  const g = r.groups[0];
  assert.deepEqual(g.reusableOffcuts, [{ length: 3000, count: 2 }]);
  assert.equal(g.reusableLength, 6000);
  assert.equal(g.scrapLength, 0);
  // below the threshold it is scrap
  const r2 = CutOpt.optimize(job([{ diameter: 20, grade: '', length: 11500, qty: 1 }], { minOffcut: 1000 }));
  assert.equal(r2.groups[0].reusableLength, 0);
  assert.equal(r2.groups[0].scrapLength, 500);
});

test('allowance is added to each piece and reported as its own loss', () => {
  const input = job([{ diameter: 16, grade: '', length: 3990, qty: 3 }], { allowance: 10 });
  const r = CutOpt.optimize(input);
  checkPlan(input, r);
  const g = r.groups[0];
  assert.equal(g.bars, 1);
  assert.equal(g.allowanceLength, 30);
  assert.equal(g.requiredLength, 11970);
});

test('weights by diameter use nominal mass', () => {
  const r = CutOpt.optimize(job([{ diameter: 16, grade: '', length: 12000, qty: 100 }]));
  const g = r.groups[0];
  assert.equal(g.bars, 100);
  assert.equal((g.weightPurchasedKg / 1000).toFixed(3), (CutOpt.massPerMetre(16) * 1200 / 1000).toFixed(3));
});

test('validation: bad inputs are rejected with codes and line numbers', () => {
  const bad = CutOpt.optimize(job([
    { diameter: 16, grade: '', length: 13000, qty: 1 },
    { diameter: 0, grade: '', length: 1000, qty: 1 },
    { diameter: 16, grade: '', length: 1000, qty: 1.5 }
  ]));
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.errors.map(e => [e.code, e.line]), [['tooLong', 0], ['diameter', 1], ['qty', 2]]);
  assert.equal(CutOpt.optimize(job([])).errors[0].code, 'empty');
  assert.equal(CutOpt.optimize(job([{ diameter: 16, length: 1000, qty: 1 }], { stockLength: 500 })).errors[0].code, 'stock');
  assert.equal(CutOpt.optimize(job([{ diameter: 16, length: 1000, qty: 1 }], { kerf: 50 })).errors[0].code, 'kerf');
});

test('lower bound is never above the true optimum (random small cases)', () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let trial = 0; trial < 300; trial++) {
    const n = 3 + Math.floor(rnd() * 8);
    const items = [];
    for (let i = 0; i < n; i++) items.push({ diameter: 16, grade: '', length: 500 + Math.floor(rnd() * 23) * 500 + Math.floor(rnd() * 3) * 137, qty: 1 + Math.floor(rnd() * 2) });
    const kerf = rnd() < 0.5 ? 0 : 5;
    const input = job(items, { kerf });
    const r = CutOpt.optimize(input);
    checkPlan(input, r);
    const exact = exactBars(items.flatMap(i => Array(i.qty).fill(i.length + kerf)), 12000 + kerf);
    const g = r.groups[0];
    assert.ok(g.lowerBound <= exact, `bound ${g.lowerBound} > optimum ${exact}`);
    assert.ok(g.bars >= exact);
    // on these sizes the heuristics should be within one bar of the optimum
    assert.ok(g.bars - exact <= 1, `heuristic ${g.bars} vs optimum ${exact}`);
  }
});

test('realistic schedule fixture: all invariants hold, and it is fast', () => {
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'villa-bbs.json'), 'utf8'));
  const input = Object.assign({}, base, fx.settings, { items: fx.items });
  const t0 = Date.now();
  const r = CutOpt.optimize(input);
  const ms = Date.now() - t0;
  checkPlan(input, r);
  assert.ok(ms < 2000, 'took ' + ms + ' ms');
  assert.ok(r.totals.wastePct < 10, 'waste ' + r.totals.wastePct.toFixed(2) + '%');
  // reproducible: same input, same plan
  assert.deepEqual(CutOpt.optimize(input), r);
});

test('large quantities stay fast (20,000 pieces)', () => {
  const items = [];
  [3450, 2875, 5100, 1250, 7800, 960, 4200, 6350].forEach((L, i) =>
    items.push({ diameter: 12 + (i % 3) * 4, grade: 'Gr60', length: L, qty: 2500 }));
  const input = job(items, { kerf: 3, minOffcut: 1000 });
  const t0 = Date.now();
  const r = CutOpt.optimize(input);
  const ms = Date.now() - t0;
  checkPlan(input, r);
  assert.ok(ms < 5000, 'took ' + ms + ' ms');
  r.groups.forEach(g => assert.ok(g.gap <= Math.ceil(g.lowerBound * 0.02) + 1, 'gap ' + g.gap + ' on ' + g.lowerBound));
});
