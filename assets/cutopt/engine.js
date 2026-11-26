/* ==========================================================================
   mashharawi.com, rebar cutting optimizer: the calculation engine
   --------------------------------------------------------------------------
   One-dimensional cutting stock problem: cut a list of required pieces from
   stock bars of one length, using as few bars as possible.

   This file has no DOM code. It runs the same in the browser (window.CutOpt)
   and in Node (require), so every figure the page shows can be reproduced by
   the tests in /tests.

   Units. Everything inside is integer millimetres. Lengths arrive in mm and
   leave in mm, so there is no floating point drift on large jobs. Masses are
   computed at the very end from the nominal formula:

       m = 0.006165 * d^2  kg/m   (the same constant as the BBS Analyzer)

   Kerf. Every cut removes `kerf` mm. A bar cut into n pieces needs n cuts if
   something is left over and n - 1 if the last piece ends exactly at the bar
   end. Modelling each piece as (length + kerf) on a bar of (stock + kerf)
   gives exactly that rule. If the leftover after the last piece is shorter
   than one kerf, the saw turns it into dust, and it is counted as kerf loss.

   Allowance. An optional extra length added to every piece (a cutting
   tolerance). It is cut and delivered with the piece, so it counts against
   utilisation, and the report shows it separately.

   Optimality. Minimising the number of stock bars is NP-hard in general. The
   engine solves the linear relaxation by column generation (Gilmore and
   Gomory), rounds it to whole bars, also runs three quick heuristics, and
   keeps the best plan. It then compares that plan with a lower bound: the
   larger of Martello and Toth's L2 and an LP dual (Farley) bound that is
   certified in exact integer arithmetic, so it is valid even when the LP
   stops early or floating point drifts (see certifiedBound). When the bar count
   equals the bound, the plan is PROVEN to use the minimum number of bars,
   and with one stock length that also means the minimum total waste. When it
   does not, the plan is reported as heuristic with the gap to the bound. The
   engine never claims an optimum it has not proved.

   Grouping. Pieces are only ever combined with pieces of the same diameter
   and the same grade.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CutOpt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Nominal mass per metre, the constant used site-wide for rebar tools:
  // 0.006165 x d^2 kg/m (pi/4 x 7850 / 1e6 = 0.0061654, rounded as in the
  // brief). The BBS Analyzer uses the same constant, so both tools agree.
  var K_MASS = 0.006165;                     // kg/m per mm^2 of d^2

  var LIMITS = {
    stockMin: 1000, stockMax: 30000,         // mm
    kerfMax: 20,                             // mm
    allowanceMax: 200,                       // mm
    diameterMin: 4, diameterMax: 60,         // mm
    qtyMax: 100000,                          // per line
    piecesMax: 200000,                       // per job
    bfdMaxPieces: 6000,                      // best fit is O(n * bars); skipped above this
    lpMaxIter: 400,                          // column generation iterations per group
    lpTimeMs: 1500                           // and a time budget per group; the bound stays valid if either stops it
  };

  function massPerMetre(d) { return K_MASS * d * d; }

  /* ---- validation ------------------------------------------------------- */
  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

  /* Returns { settings, groups: Map key -> group, errors: [] }. Errors carry a
     code and the 0-based line index so the page can translate them and point
     at the right row. */
  function normalise(input) {
    var errors = [];
    var s = {
      stock: input.stockLength,
      kerf: input.kerf || 0,
      allowance: input.allowance || 0,
      minOffcut: input.minOffcut || 0,
      // testing hooks: force an early stop of the LP. Not exposed in the page.
      lpMaxIter: isInt(input._lpMaxIter) && input._lpMaxIter >= 0 ? input._lpMaxIter : LIMITS.lpMaxIter,
      lpTimeMs: isInt(input._lpTimeMs) && input._lpTimeMs >= 0 ? input._lpTimeMs : LIMITS.lpTimeMs
    };
    if (!isInt(s.stock) || s.stock < LIMITS.stockMin || s.stock > LIMITS.stockMax) errors.push({ code: 'stock' });
    if (!isInt(s.kerf) || s.kerf < 0 || s.kerf > LIMITS.kerfMax) errors.push({ code: 'kerf' });
    if (!isInt(s.allowance) || s.allowance < 0 || s.allowance > LIMITS.allowanceMax) errors.push({ code: 'allowance' });
    if (!isInt(s.minOffcut) || s.minOffcut < 0 || s.minOffcut > (s.stock || 0)) errors.push({ code: 'minOffcut' });

    var groups = {};
    var order = [];
    var pieces = 0;
    (input.items || []).forEach(function (it, i) {
      var d = Number(it.diameter);
      var L = it.length;
      var q = it.qty;
      var grade = String(it.grade == null ? '' : it.grade).trim().slice(0, 40);
      if (!(d >= LIMITS.diameterMin && d <= LIMITS.diameterMax)) { errors.push({ code: 'diameter', line: i }); return; }
      if (!isInt(L) || L <= 0) { errors.push({ code: 'length', line: i }); return; }
      if (!isInt(q) || q < 1 || q > LIMITS.qtyMax) { errors.push({ code: 'qty', line: i }); return; }
      if (isInt(s.stock) && L + s.allowance > s.stock) { errors.push({ code: 'tooLong', line: i }); return; }
      pieces += q;
      var key = d + '|' + grade.toUpperCase();
      if (!groups[key]) { groups[key] = { diameter: d, grade: grade, demand: {}, lines: [] }; order.push(key); }
      groups[key].demand[L] = (groups[key].demand[L] || 0) + q;
      groups[key].lines.push(i);
    });
    if (pieces > LIMITS.piecesMax) errors.push({ code: 'tooMany' });
    if (!order.length && !errors.length) errors.push({ code: 'empty' });
    return { settings: s, groups: groups, order: order, errors: errors };
  }

  /* ---- lower bound ------------------------------------------------------ */
  /* Martello-Toth L2 for bin packing, on weights w (with counts) and
     capacity C. Valid for any K in [0, C/2]; it is enough to try K = 0 and
     every distinct weight up to C/2. L2 >= L1 = ceil(sum / C). */
  function lowerBound(types, C) {
    var total = 0;
    types.forEach(function (t) { total += t.w * t.n; });
    var best = Math.ceil(total / C);
    var ks = [0];
    types.forEach(function (t) { if (2 * t.w <= C) ks.push(t.w); });
    ks.forEach(function (K) {
      var n1 = 0, n2 = 0, s2 = 0, s3 = 0;
      types.forEach(function (t) {
        if (t.w > C - K) n1 += t.n;
        else if (2 * t.w > C) { n2 += t.n; s2 += t.w * t.n; }
        else if (t.w >= K) s3 += t.w * t.n;
      });
      var free = n2 * C - s2;
      var extra = Math.max(0, Math.ceil((s3 - free) / C));
      var lb = n1 + n2 + extra;
      if (lb > best) best = lb;
    });
    return best;
  }

  /* ---- best single-bar pattern ----------------------------------------- */
  /* Bounded subset sum: the combination of remaining pieces that fills one
     bar (capacity C) as completely as possible. Counts are split into binary
     chunks (1, 2, 4, ...) so it becomes a 0/1 problem; the DP keeps, for
     every reachable fill, the chunk that first reached it. Larger pieces are
     processed first, so among equal fills the one with larger pieces wins. */
  function bestPattern(types, rem, C) {
    var chunks = [];
    for (var i = 0; i < types.length; i++) {
      var c = Math.min(rem[i], Math.floor(C / types[i].w));
      var k = 1;
      while (c > 0) {
        var take = Math.min(k, c);
        chunks.push({ t: i, n: take, w: take * types[i].w });
        c -= take; k *= 2;
      }
    }
    var from = new Int32Array(C + 1).fill(-1);
    from[0] = -2;
    for (var j = 0; j < chunks.length; j++) {
      var W = chunks[j].w;
      for (var cap = C; cap >= W; cap--) {
        if (from[cap] === -1 && from[cap - W] !== -1) from[cap] = j;
      }
    }
    var top = C;
    while (top > 0 && from[top] === -1) top--;
    var pat = new Array(types.length).fill(0);
    var p = top;
    while (p > 0) { var ch = chunks[from[p]]; pat[ch.t] += ch.n; p -= ch.w; }
    return pat;
  }

  /* ---- strategies ------------------------------------------------------- */
  /* Each returns a list of { pat: counts per type, times }. */

  // Sequential pattern generation: best-filled bar, repeated as long as the
  // remaining quantities allow, then the next best, and so on.
  function sequential(types, C) {
    var rem = types.map(function (t) { return t.n; });
    var out = [];
    var left = rem.reduce(function (a, b) { return a + b; }, 0);
    while (left > 0) {
      var pat = bestPattern(types, rem, C);
      var times = Infinity;
      for (var i = 0; i < pat.length; i++) if (pat[i]) times = Math.min(times, Math.floor(rem[i] / pat[i]));
      for (i = 0; i < pat.length; i++) { rem[i] -= pat[i] * times; left -= pat[i] * times; }
      out.push({ pat: pat, times: times });
    }
    return out;
  }

  // First fit decreasing. Identical pieces arrive together, so each type is
  // poured into the open bars in order; that is exactly FFD, in O(types*bars).
  function firstFit(types, C) {
    var bars = [];                                   // { free, pat }
    types.forEach(function (t, i) {
      var n = t.n;
      for (var b = 0; b < bars.length && n > 0; b++) {
        var k = Math.min(n, Math.floor(bars[b].free / t.w));
        if (k > 0) { bars[b].pat[i] += k; bars[b].free -= k * t.w; n -= k; }
      }
      var per = Math.floor(C / t.w);
      while (n > 0) {
        var k2 = Math.min(n, per);
        var pat = new Array(types.length).fill(0);
        pat[i] = k2;
        bars.push({ free: C - k2 * t.w, pat: pat });
        n -= k2;
      }
    });
    return bars.map(function (b) { return { pat: b.pat, times: 1 }; });
  }

  // Best fit decreasing: each piece goes to the bar it fills most tightly.
  function bestFit(types, C) {
    var bars = [];
    types.forEach(function (t, i) {
      for (var n = 0; n < t.n; n++) {
        var bi = -1, bf = Infinity;
        for (var b = 0; b < bars.length; b++) {
          var f = bars[b].free - t.w;
          if (f >= 0 && f < bf) { bf = f; bi = b; if (f === 0) break; }
        }
        if (bi < 0) {
          bars.push({ free: C, pat: new Array(types.length).fill(0) });
          bi = bars.length - 1;
        }
        bars[bi].pat[i]++; bars[bi].free -= t.w;
      }
    });
    return bars.map(function (b) { return { pat: b.pat, times: 1 }; });
  }

  /* ---- LP relaxation by column generation (Gilmore and Gomory) ---------- */
  /* min sum(x_p)  subject to  sum(a_p * x_p) >= demand,  x >= 0, over all
     feasible patterns p. Revised simplex, starting from the homogeneous
     patterns (one size per bar), which are always feasible, so no phase one
     is needed. New patterns are priced by a bounded knapsack on the duals.

     Returns { x: [{pat, value}], bound } where bound is a valid lower bound
     on the number of bars: ceil(LP optimum), or Farley's bound z / max(y.a)
     if the iteration limit stops it before the LP is solved. */
  function knapsackValue(types, y, C) {
    var chunks = [];
    for (var i = 0; i < types.length; i++) {
      if (!(y[i] > 1e-12)) continue;
      var c = Math.min(types[i].n, Math.floor(C / types[i].w)), k = 1;
      while (c > 0) {
        var take = Math.min(k, c);
        chunks.push({ t: i, n: take, w: take * types[i].w, v: take * y[i] });
        c -= take; k *= 2;
      }
    }
    var best = new Float64Array(C + 1);
    var pick = new Uint8Array(chunks.length * (C + 1));
    for (var j = 0; j < chunks.length; j++) {
      var W = chunks[j].w, V = chunks[j].v, off = j * (C + 1);
      for (var cap = C; cap >= W; cap--) {
        var cand = best[cap - W] + V;
        if (cand > best[cap] + 1e-12) { best[cap] = cand; pick[off + cap] = 1; }
      }
    }
    var pat = new Array(types.length).fill(0);
    var p = C;
    for (j = chunks.length - 1; j >= 0; j--) {
      if (pick[j * (C + 1) + p]) { pat[chunks[j].t] += chunks[j].n; p -= chunks[j].w; }
    }
    var val = 0;
    for (i = 0; i < types.length; i++) val += pat[i] * y[i];
    return { pat: pat, value: val };
  }

  function lpRelaxation(types, C, maxIter, deadline) {
    var m = types.length;
    var d = types.map(function (t) { return t.n; });
    // basis: pattern (null for a surplus column), cost, Binv rows, xB
    var basis = [], Binv = [], xB = [];
    for (var i = 0; i < m; i++) {
      var k = Math.min(Math.floor(C / types[i].w), d[i]);
      var col = new Array(m).fill(0); col[i] = k;
      basis.push({ pat: col, cost: 1 });
      var row = new Array(m).fill(0); row[i] = 1 / k;
      Binv.push(row);
      xB.push(d[i] / k);
    }
    var EPS = 1e-9, iter = 0, stop = 'iterations', y = null;
    for (; iter < maxIter; iter++) {
      if (deadline && Date.now() > deadline) { stop = 'time'; break; }
      y = new Array(m).fill(0);
      for (var r = 0; r < m; r++) if (basis[r].cost) for (var c = 0; c < m; c++) y[c] += Binv[r][c];

      var enter = null;
      for (i = 0; i < m; i++) if (y[i] < -EPS) {         // a surplus column prices out
        var s = new Array(m).fill(0); s[i] = -1;
        enter = { col: s, cost: 0, pat: null }; break;
      }
      if (!enter) {
        var kn = knapsackValue(types, y, C);
        if (kn.value <= 1 + EPS) { stop = 'converged'; break; }
        enter = { col: kn.pat, cost: 1, pat: kn.pat };
      }
      var u = new Array(m).fill(0);
      for (r = 0; r < m; r++) for (c = 0; c < m; c++) u[r] += Binv[r][c] * enter.col[c];
      var lr = -1, best = Infinity;
      for (r = 0; r < m; r++) if (u[r] > EPS) {
        var ratio = xB[r] / u[r];
        if (ratio < best - 1e-12) { best = ratio; lr = r; }
      }
      if (lr < 0) { stop = 'numerical'; break; }          // no pivot row: stop, the bound below is still valid
      var piv = u[lr];
      for (c = 0; c < m; c++) Binv[lr][c] /= piv;
      xB[lr] /= piv;
      for (r = 0; r < m; r++) if (r !== lr && u[r] !== 0) {
        var f = u[r];
        for (c = 0; c < m; c++) Binv[r][c] -= f * Binv[lr][c];
        xB[r] -= f * xB[lr];
        if (xB[r] < 0 && xB[r] > -1e-9) xB[r] = 0;
      }
      basis[lr] = { pat: enter.pat, cost: enter.cost };
    }
    if (!y) {                                              // limit hit before the first duals
      y = new Array(m).fill(0);
      for (r = 0; r < m; r++) if (basis[r].cost) for (c = 0; c < m; c++) y[c] += Binv[r][c];
    }
    var x = [];
    for (r = 0; r < m; r++) if (basis[r].cost && basis[r].pat && xB[r] > EPS) x.push({ pat: basis[r].pat, value: xB[r] });
    return { x: x, bound: certifiedBound(types, C, y), iterations: iter, stop: stop };
  }

  /* A lower bound on the number of bars that does not depend on the simplex
     having converged, nor on floating point being exact.

     LP duality: for ANY vector y >= 0, if V = max over feasible patterns a of
     y.a, then y / V is feasible for the dual LP, so
         LP optimum >= (y.d) / V      (Farley's bound)
     and the number of bars, an integer >= LP optimum, is >= ceil(y.d / V).
     Patterns may be restricted to a_i <= d_i: any cutting plan can drop
     surplus pieces, so this restricted LP is still a relaxation.

     To make that exact, the simplex duals are only used as a guide: they are
     clipped to >= 0, scaled so the largest is 1e9 and floored to integers Y.
     Flooring keeps Y >= 0, so the bound stays valid for Y. Then V is found by
     an integer knapsack and N = Y.d by integer sums, both below 2^53, so the
     doubles hold them exactly, and ceil(N / V) is taken in integers. If any
     quantity would leave the exact integer range, no LP bound is claimed. */
  var SCALE = 1e9;
  function certifiedBound(types, C, y) {
    var m = types.length, top = 0, i;
    for (i = 0; i < m; i++) if (y[i] > top) top = y[i];
    if (!(top > 0) || !isFinite(top)) return 0;
    var Y = new Array(m);
    for (i = 0; i < m; i++) Y[i] = y[i] > 0 ? Math.floor(y[i] / top * SCALE) : 0;
    var N = 0;
    for (i = 0; i < m; i++) N += Y[i] * types[i].n;
    if (!Number.isSafeInteger(N) || N === 0) return 0;
    // integer bounded knapsack: V = max Y.a with sum(w.a) <= C, a_i <= min(d_i, C / w_i)
    var best = new Float64Array(C + 1);
    for (i = 0; i < m; i++) {
      if (!Y[i]) continue;
      var c = Math.min(types[i].n, Math.floor(C / types[i].w)), k = 1;
      while (c > 0) {
        var take = Math.min(k, c), W = take * types[i].w, V = take * Y[i];
        for (var cap = C; cap >= W; cap--) {
          var cand = best[cap - W] + V;
          if (cand > best[cap]) best[cap] = cand;
        }
        c -= take; k *= 2;
      }
    }
    var Vmax = best[C];
    if (!Number.isSafeInteger(Vmax) || Vmax <= 0) return 0;
    // ceil(N / Vmax) in exact integer arithmetic
    var q = Math.floor(N / Vmax);
    while (q * Vmax < N) q++;
    while (q > 0 && (q - 1) * Vmax >= N) q--;
    return q;
  }

  /* Round the LP down, trim any over-production, and finish the remaining
     pieces with the best of the quick heuristics. */
  function lpRounding(types, C, lp) {
    var plan = [];
    var made = new Array(types.length).fill(0);
    lp.x.forEach(function (e) {
      var t = Math.floor(e.value + 1e-9);
      if (t > 0) { plan.push({ pat: e.pat.slice(), times: t }); e.pat.forEach(function (a, i) { made[i] += a * t; }); }
    });
    // over-production: take pieces out of single bars, starting from the end
    for (var i = 0; i < types.length; i++) {
      var over = made[i] - types[i].n;
      for (var p = plan.length - 1; p >= 0 && over > 0; p--) {
        while (over > 0 && plan[p].times > 0 && plan[p].pat[i] > 0) {
          var single = plan[p].pat.slice();
          var cut = Math.min(over, single[i]);
          single[i] -= cut; over -= cut; made[i] -= cut;
          plan[p].times--;
          if (single.some(function (a) { return a > 0; })) plan.push({ pat: single, times: 1 });
        }
      }
    }
    plan = plan.filter(function (e) { return e.times > 0; });
    var rest = [];
    types.forEach(function (t, j) {
      var n = t.n - made[j];
      rest.push({ len: t.len, piece: t.piece, w: t.w, n: Math.max(0, n) });
    });
    if (rest.some(function (t) { return t.n > 0; })) {
      var tails = [sequential(rest, C), firstFit(rest, C)];
      var nRest = rest.reduce(function (a, t) { return a + t.n; }, 0);
      if (nRest <= LIMITS.bfdMaxPieces) tails.push(bestFit(rest, C));
      var bestTail = null, bestCount = Infinity;
      tails.forEach(function (tl) {
        var cnt = tl.reduce(function (a, e) { return a + e.times; }, 0);
        if (cnt < bestCount) { bestCount = cnt; bestTail = tl; }
      });
      plan = plan.concat(bestTail);
    }
    return plan;
  }

  /* ---- solve one diameter/grade group ----------------------------------- */
  function solveGroup(g, s) {
    var C = s.stock + s.kerf;
    var types = Object.keys(g.demand).map(Number).sort(function (a, b) { return b - a; }).map(function (L) {
      var piece = L + s.allowance;
      return { len: L, piece: piece, w: piece + s.kerf, n: g.demand[L] };
    });
    var nPieces = types.reduce(function (a, t) { return a + t.n; }, 0);
    var lp = lpRelaxation(types, C, s.lpMaxIter, Date.now() + s.lpTimeMs);
    var l2 = lowerBound(types, C);
    var lb = Math.max(l2, lp.bound);

    var tries = [
      { name: 'lp', plan: lpRounding(types, C, lp) },
      { name: 'sequential', plan: sequential(types, C) },
      { name: 'ffd', plan: firstFit(types, C) }
    ];
    if (nPieces <= LIMITS.bfdMaxPieces) tries.push({ name: 'bfd', plan: bestFit(types, C) });

    var best = null;
    tries.forEach(function (t) {
      var r = summarise(t.plan, types, s);
      r.method = t.name;
      if (!best || better(r, best)) best = r;
    });

    var out = best;
    out.diameter = g.diameter;
    out.grade = g.grade;
    out.lines = g.lines;
    out.lowerBound = lb;
    out.boundL2 = l2;
    out.boundLP = lp.bound;
    out.lpStop = lp.stop;
    out.lpIterations = lp.iterations;
    out.optimal = out.bars === lb;
    out.gap = out.bars - lb;
    out.pieces = nPieces;
    out.massPerMetre = massPerMetre(g.diameter);
    out.weightPurchasedKg = out.purchasedLength / 1000 * out.massPerMetre;
    out.weightRequiredKg = out.requiredLength / 1000 * out.massPerMetre;
    out.weightWasteKg = out.wasteLength / 1000 * out.massPerMetre;
    out.weightReusableKg = out.reusableLength / 1000 * out.massPerMetre;
    return out;
  }

  // Fewer bars first; then more of the waste in reusable offcuts; then fewer
  // distinct patterns, which is easier for the workshop.
  function better(a, b) {
    if (a.bars !== b.bars) return a.bars < b.bars;
    if (a.reusableLength !== b.reusableLength) return a.reusableLength > b.reusableLength;
    return a.patterns.length < b.patterns.length;
  }

  /* Merge identical bars into patterns and compute every total. */
  function summarise(plan, types, s) {
    var byKey = {};
    var keys = [];
    plan.forEach(function (p) {
      var k = p.pat.join(',');
      if (!byKey[k]) { byKey[k] = { pat: p.pat, count: 0 }; keys.push(k); }
      byKey[k].count += p.times;
    });

    var bars = 0, required = 0, cutLen = 0, kerfLoss = 0, offTotal = 0, reusable = 0;
    var offcuts = {};
    var patterns = keys.map(function (k) {
      var e = byKey[k];
      var cuts = [];
      var sumPiece = 0, sumNominal = 0, n = 0;
      e.pat.forEach(function (c, i) {
        for (var x = 0; x < c; x++) cuts.push(types[i].piece);
        sumPiece += c * types[i].piece;
        sumNominal += c * types[i].len;
        n += c;
      });
      var offcut = Math.max(0, s.stock - sumPiece - n * s.kerf);
      var kerf = s.stock - sumPiece - offcut;
      var isReusable = offcut > 0 && s.minOffcut > 0 && offcut >= s.minOffcut;
      bars += e.count;
      required += sumNominal * e.count;
      cutLen += sumPiece * e.count;
      kerfLoss += kerf * e.count;
      offTotal += offcut * e.count;
      if (isReusable) {
        reusable += offcut * e.count;
        offcuts[offcut] = (offcuts[offcut] || 0) + e.count;
      }
      return {
        cuts: cuts,                 // piece lengths in mm, allowance included
        count: e.count,             // how many bars are cut this way
        pieces: n,
        used: sumPiece,
        kerf: kerf,
        offcut: offcut,
        reusable: isReusable
      };
    });
    patterns.sort(function (a, b) { return b.count - a.count || a.offcut - b.offcut; });

    var purchased = bars * s.stock;
    return {
      bars: bars,
      patterns: patterns,
      purchasedLength: purchased,
      requiredLength: required,
      allowanceLength: cutLen - required,
      kerfLength: kerfLoss,
      offcutLength: offTotal,
      reusableLength: reusable,
      scrapLength: offTotal - reusable,
      wasteLength: purchased - required,
      wastePct: purchased ? (purchased - required) / purchased * 100 : 0,
      utilisationPct: purchased ? required / purchased * 100 : 0,
      reusableOffcuts: Object.keys(offcuts).map(Number).sort(function (a, b) { return b - a; })
        .map(function (L) { return { length: L, count: offcuts[L] }; })
    };
  }

  /* ---- public entry point ----------------------------------------------- */
  /* input: {
       stockLength: mm (integer), kerf: mm, allowance: mm, minOffcut: mm,
       items: [{ diameter: mm, grade: string, length: mm (integer), qty: int }]
     } */
  function optimize(input) {
    var n = normalise(input || {});
    if (n.errors.length) return { ok: false, errors: n.errors };
    var groups = n.order.map(function (k) { return solveGroup(n.groups[k], n.settings); });
    groups.sort(function (a, b) { return a.diameter - b.diameter || (a.grade < b.grade ? -1 : a.grade > b.grade ? 1 : 0); });

    var t = { bars: 0, pieces: 0, purchasedLength: 0, requiredLength: 0, wasteLength: 0, reusableLength: 0,
              kerfLength: 0, allowanceLength: 0, scrapLength: 0,
              weightPurchasedKg: 0, weightRequiredKg: 0, weightWasteKg: 0, weightReusableKg: 0 };
    groups.forEach(function (g) { Object.keys(t).forEach(function (k) { t[k] += g[k]; }); });
    t.wastePct = t.purchasedLength ? t.wasteLength / t.purchasedLength * 100 : 0;
    t.utilisationPct = t.purchasedLength ? t.requiredLength / t.purchasedLength * 100 : 0;
    t.allOptimal = groups.every(function (g) { return g.optimal; });

    var pub = { stock: n.settings.stock, kerf: n.settings.kerf, allowance: n.settings.allowance, minOffcut: n.settings.minOffcut };
    return { ok: true, settings: pub, groups: groups, totals: t };
  }

  /* Metres as typed (string or number, comma or dot) to integer mm. */
  function metresToMm(v) {
    if (typeof v === 'string') v = v.trim().replace(',', '.');
    var x = Number(v);
    if (v === '' || !isFinite(x)) return NaN;
    return Math.round(x * 1000);
  }

  return {
    optimize: optimize,
    massPerMetre: massPerMetre,
    metresToMm: metresToMm,
    lowerBound: lowerBound,
    LIMITS: LIMITS,
    _internal: { certifiedBound: certifiedBound, lpRelaxation: lpRelaxation, bestPattern: bestPattern, sequential: sequential, firstFit: firstFit, bestFit: bestFit }
  };
});
