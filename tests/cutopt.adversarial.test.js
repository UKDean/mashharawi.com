/* Adversarial and edge-case tests for assets/cutopt/engine.js.
   The rule under test above all others: the page may say "proven minimum"
   only when the lower bound is mathematically valid. Every random case here
   is checked against an exhaustive search, and the LP is forced to stop
   early to show the bound holds without convergence. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const CutOpt = require('../assets/cutopt/engine.js');
const { checkPlan, exactBars, rng } = require('./helpers.js');

const base = { stockLength: 12000, kerf: 0, allowance: 0, minOffcut: 0 };
const job = (items, extra) => Object.assign({}, base, extra || {}, { items });
const expand = (items, s) => items.flatMap(i => Array(i.qty).fill(i.length + (s.allowance || 0) + (s.kerf || 0)));

/* A small random job: up to 10 pieces, so exhaustive search is quick. */
function smallJob(r, extra) {
  const items = [];
  const kinds = 1 + Math.floor(r() * 4);
  let left = 3 + Math.floor(r() * 8);
  for (let k = 0; k < kinds && left > 0; k++) {
    const q = k === kinds - 1 ? left : 1 + Math.floor(r() * Math.min(3, left));
    left -= q;
    items.push({ diameter: 16, grade: 'Gr60', length: 250 + Math.floor(r() * 11500), qty: q });
  }
  return job(items, extra);
}

test('certified LP bound is valid for ANY dual vector, including bad ones', () => {
  const r = rng(2026);
  const C = 12003;
  for (let trial = 0; trial < 200; trial++) {
    const input = smallJob(r, { kerf: 3 });
    const sizes = expand(input.items, input);
    const exact = exactBars(sizes, C);
    // the engine merges equal lengths into types; do the same
    const byW = {};
    sizes.forEach(w => { byW[w] = (byW[w] || 0) + 1; });
    const types = Object.keys(byW).map(Number).sort((a, b) => b - a).map(w => ({ w, n: byW[w] }));
    for (let v = 0; v < 6; v++) {
      // random, negative, tiny, huge, and denormal-ish duals
      const y = types.map(() => {
        const u = r();
        if (u < 0.15) return -u;
        if (u < 0.3) return u * 1e-14;
        if (u < 0.45) return u * 1e12;
        return u;
      });
      const b = CutOpt._internal.certifiedBound(types, C, y);
      assert.ok(Number.isInteger(b) && b >= 0);
      assert.ok(b <= exact, `certified bound ${b} > optimum ${exact} for y=${y}`);
    }
  }
});

test('early LP termination never produces a false "proven minimum"', () => {
  const r = rng(77);
  for (let trial = 0; trial < 250; trial++) {
    const extra = { kerf: [0, 3, 5][trial % 3], allowance: [0, 0, 10][trial % 3], _lpMaxIter: [0, 1, 2, 5, 400][trial % 5] };
    const input = smallJob(r, extra);
    const res = CutOpt.optimize(input);
    checkPlan(input, res);
    const g = res.groups[0];
    const exact = exactBars(expand(input.items, input), 12000 + input.kerf);
    assert.ok(g.lowerBound <= exact, `bound ${g.lowerBound} > optimum ${exact}`);
    assert.ok(g.bars >= exact);
    if (g.optimal) assert.equal(g.bars, exact, 'claimed proven minimum but a better plan exists');
    assert.equal(g.optimal, g.bars === g.lowerBound);
  }
});

test('time budget of zero: still a valid plan and an honest flag (large job)', () => {
  const items = [];
  const r = rng(5);
  for (let i = 0; i < 60; i++) items.push({ diameter: 20, grade: 'Gr60', length: 400 + Math.floor(r() * 11000), qty: 1 + Math.floor(r() * 80) });
  const input = job(items, { kerf: 3, minOffcut: 1000, _lpTimeMs: 0 });
  const res = CutOpt.optimize(input);
  checkPlan(input, res);
  const g = res.groups[0];
  assert.ok(['time', 'iterations', 'converged'].includes(g.lpStop));
  assert.ok(g.lowerBound >= g.boundL2);
  assert.equal(g.optimal, g.bars === g.lowerBound);
  // the full run can only tighten things; its bound must not be below a
  // plan's bars count from the truncated run by more than the plans differ
  const full = CutOpt.optimize(Object.assign({}, input, { _lpTimeMs: undefined }));
  checkPlan(input, full);
  assert.ok(full.groups[0].lowerBound <= g.bars && g.lowerBound <= full.groups[0].bars);
});

test('the certified bound matches the LP on a known instance', () => {
  // 5100 x 2500 and 960 x 2500 at kerf 3: LP optimum is about 1346.2, so a
  // certified bound of 1347 proves the 1347-bar plan.
  const input = job([{ diameter: 20, grade: '', length: 5100, qty: 2500 }, { diameter: 20, grade: '', length: 960, qty: 2500 }], { kerf: 3 });
  const res = CutOpt.optimize(input);
  checkPlan(input, res);
  const g = res.groups[0];
  assert.equal(g.lpStop, 'converged');
  assert.equal(g.boundLP, 1347);
  assert.equal(g.bars, 1347);
  assert.equal(g.optimal, true);
  assert.ok(g.boundL2 < g.boundLP, 'L2 alone would not have proved it');
});

test('exact triplets (hard bin packing shape) are solved or honestly flagged', () => {
  const r = rng(9);
  for (let trial = 0; trial < 20; trial++) {
    // three pieces that fill a bar exactly, shuffled across 3 bars
    const items = [];
    for (let b = 0; b < 3; b++) {
      const a = 2500 + Math.floor(r() * 2000), c = 2500 + Math.floor(r() * 2000);
      items.push({ diameter: 12, grade: '', length: a, qty: 1 }, { diameter: 12, grade: '', length: c, qty: 1 }, { diameter: 12, grade: '', length: 12000 - a - c, qty: 1 });
    }
    const input = job(items);
    const res = CutOpt.optimize(input);
    checkPlan(input, res);
    const g = res.groups[0];
    const exact = exactBars(expand(items, input), 12000);
    assert.equal(exact, 3);
    assert.ok(g.lowerBound <= 3);
    if (g.optimal) assert.equal(g.bars, 3);
  }
});

test('kerf edge cases', () => {
  // a piece exactly the stock length: no cut, no kerf loss
  let res = CutOpt.optimize(job([{ diameter: 16, grade: '', length: 12000, qty: 5 }], { kerf: 5 }));
  assert.equal(res.groups[0].bars, 5);
  assert.equal(res.groups[0].kerfLength, 0);
  // two pieces that fit with exactly one kerf...
  res = CutOpt.optimize(job([{ diameter: 16, grade: '', length: 5997, qty: 2 }], { kerf: 6 }));
  assert.equal(res.groups[0].bars, 1);
  // ...and 1 mm more does not
  res = CutOpt.optimize(job([{ diameter: 16, grade: '', length: 5998, qty: 2 }], { kerf: 5 }));
  assert.equal(res.groups[0].bars, 2);
  // a sliver shorter than the kerf is kerf loss, not an offcut
  const input = job([{ diameter: 16, grade: '', length: 3998, qty: 3 }], { kerf: 2, minOffcut: 1 });
  res = CutOpt.optimize(input);
  checkPlan(input, res);
  assert.equal(res.groups[0].patterns[0].offcut, 0);
  assert.equal(res.groups[0].kerfLength, 6);
});

test('allowance edge cases', () => {
  // allowance pushes the piece past the stock length: rejected, not silently cut
  const bad = CutOpt.optimize(job([{ diameter: 16, grade: '', length: 11950, qty: 1 }], { allowance: 60 }));
  assert.equal(bad.ok, false);
  assert.equal(bad.errors[0].code, 'tooLong');
  // allowance with kerf: 3 x (3990 + 5) + 2 x 3 = 11991
  const input = job([{ diameter: 16, grade: '', length: 3990, qty: 3 }], { allowance: 5, kerf: 3 });
  const res = CutOpt.optimize(input);
  checkPlan(input, res);
  assert.equal(res.groups[0].bars, 1);
  assert.equal(res.groups[0].allowanceLength, 15);
});

test('large quantities: exact multiples are proven, and the piece limit is enforced', () => {
  let input = job([{ diameter: 12, grade: 'Gr60', length: 2400, qty: 100000 }]);
  let res = CutOpt.optimize(input);
  checkPlan(input, res);
  assert.equal(res.groups[0].bars, 20000);
  assert.equal(res.groups[0].optimal, true);
  assert.equal(res.groups[0].wasteLength, 0);

  input = job([{ diameter: 12, grade: '', length: 1, qty: 100000 }, { diameter: 12, grade: '', length: 2, qty: 100000 }]);
  res = CutOpt.optimize(input);
  checkPlan(input, res);
  assert.equal(res.groups[0].bars, 25);

  const over = CutOpt.optimize(job([{ diameter: 12, grade: '', length: 1000, qty: 100000 },
    { diameter: 14, grade: '', length: 1000, qty: 100000 }, { diameter: 16, grade: '', length: 1000, qty: 1 }]));
  assert.equal(over.ok, false);
  assert.equal(over.errors[0].code, 'tooMany');
});

test('many distinct cutting lengths: valid, honest, and within the time budget', () => {
  const r = rng(31337);
  const items = [];
  for (let i = 0; i < 150; i++) items.push({ diameter: 16, grade: 'Gr60', length: 300 + Math.floor(r() * 11000), qty: 1 + Math.floor(r() * 40) });
  const input = job(items, { kerf: 3, minOffcut: 1000 });
  const t0 = Date.now();
  const res = CutOpt.optimize(input);
  const ms = Date.now() - t0;
  checkPlan(input, res);
  const g = res.groups[0];
  assert.ok(ms < 6000, 'took ' + ms + ' ms');
  assert.equal(g.optimal, g.bars === g.lowerBound);
  assert.ok(g.gap / g.lowerBound < 0.05, 'gap ' + g.gap + ' on ' + g.lowerBound);
});

test('same lengths in different diameters or grades never share a bar', () => {
  const items = [];
  [10, 12, 14, 16, 18, 20, 25, 32].forEach(d => ['Gr60', 'Gr80'].forEach(gr => items.push({ diameter: d, grade: gr, length: 4000, qty: 1 })));
  const input = job(items);
  const res = CutOpt.optimize(input);
  checkPlan(input, res);
  assert.equal(res.groups.length, 16);
  assert.equal(res.totals.bars, 16);
});

test('mixed-length random jobs with kerf and allowance match exhaustive search when proven', () => {
  const r = rng(424242);
  let proven = 0;
  for (let trial = 0; trial < 300; trial++) {
    const input = smallJob(r, { kerf: Math.floor(r() * 6), allowance: Math.floor(r() * 3) * 25 });
    const res = CutOpt.optimize(input);
    checkPlan(input, res);
    const g = res.groups[0];
    const exact = exactBars(expand(input.items, input), 12000 + input.kerf);
    assert.ok(g.lowerBound <= exact);
    if (g.optimal) { proven++; assert.equal(g.bars, exact); }
    assert.ok(g.bars - exact <= 1);
  }
  assert.ok(proven > 200, 'only ' + proven + ' of 300 proven');
});
