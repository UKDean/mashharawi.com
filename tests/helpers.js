/* Shared checks for the cutting optimizer tests. Not a test file itself. */
'use strict';
const assert = require('node:assert/strict');

/* Every invariant a plan must satisfy, whatever the heuristic did. */
function checkPlan(input, res) {
  assert.equal(res.ok, true, JSON.stringify(res.errors));
  const s = res.settings;
  // demand by diameter|grade|length
  const want = {};
  input.items.forEach(it => {
    const k = it.diameter + '|' + String(it.grade || '').toUpperCase() + '|' + (it.length + s.allowance);
    want[k] = (want[k] || 0) + it.qty;
  });
  const got = {};
  res.groups.forEach(g => {
    let bars = 0;
    g.patterns.forEach(p => {
      bars += p.count;
      const pieceSum = p.cuts.reduce((a, b) => a + b, 0);
      // never longer than the stock bar, kerf included (last cut may be free)
      assert.ok(pieceSum + (p.pieces - 1) * s.kerf <= s.stock, 'pattern exceeds stock');
      assert.equal(pieceSum + p.kerf + p.offcut, s.stock, 'bar length does not balance');
      assert.ok(p.offcut >= 0 && p.kerf >= 0);
      p.cuts.forEach(c => {
        const k = g.diameter + '|' + g.grade.toUpperCase() + '|' + c;
        got[k] = (got[k] || 0) + p.count;
      });
    });
    assert.equal(bars, g.bars);
    assert.ok(g.bars >= g.lowerBound, 'bars below the lower bound');
    assert.equal(g.optimal, g.bars === g.lowerBound);
    assert.equal(g.purchasedLength, g.bars * s.stock);
    assert.equal(g.wasteLength, g.purchasedLength - g.requiredLength);
    assert.equal(g.wasteLength, g.allowanceLength + g.kerfLength + g.offcutLength);
    assert.equal(g.offcutLength, g.reusableLength + g.scrapLength);
  });
  assert.deepEqual(got, want, 'pieces cut do not match pieces required');
}

/* Exact minimum number of bars for tiny instances, by exhaustive search. */
function exactBars(sizes, C) {
  sizes = sizes.slice().sort((a, b) => b - a);
  let best = sizes.length;
  const bins = [];
  (function go(i) {
    if (bins.length >= best) return;
    if (i === sizes.length) { best = bins.length; return; }
    const seen = new Set();
    for (let b = 0; b < bins.length; b++) {
      if (bins[b] >= sizes[i] && !seen.has(bins[b])) {
        seen.add(bins[b]); bins[b] -= sizes[i]; go(i + 1); bins[b] += sizes[i];
      }
    }
    bins.push(C - sizes[i]); go(i + 1); bins.pop();
  })(0);
  return best;
}


/* Deterministic pseudo-random numbers, so failures are reproducible. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) & 0x7fffffff) / 0x7fffffff;
}

module.exports = { checkPlan, exactBars, rng };
