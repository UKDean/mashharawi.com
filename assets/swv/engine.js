/* ==========================================================================
   mashharawi.com, Steel Weight Verification: the calculation engine
   --------------------------------------------------------------------------
   No DOM. Compares the measured weight of a rebar sample with its nominal
   (theoretical) weight. Runs in the browser (window.SwvEngine) and in Node
   for the tests.

   Rules this file keeps:
   - Nominal unit weight = 0.006165 x d^2 kg/m, the same constant as the
     cutting optimizer and the BBS Analyzer. It depends on the diameter only:
     grade (60 or 80) does not change it.
   - Deviation % = (actual - theoretical) / theoretical x 100. Positive: the
     sample weighs more than nominal; negative: less.
   - Everything is computed from the values as entered, unrounded. Rounding
     is for display only.
   - No acceptance limit is built in, and no sample is ever called
     compliant or non-compliant. If the user enters a tolerance range, the
     only statement made is whether the deviation lies inside that range.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SwvEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var K = 0.006165;                                        // kg/m per mm^2
  var AL_RAJHI_SIZES = [10, 12, 14, 16, 18, 20, 25, 32];   // product range
  var LIMITS = { dMin: 4, dMax: 60, lengthMaxMm: 12000, barsMax: 1000, kgMax: 100000, tolAbsMax: 100, text: 60, notes: 300 };

  function unitWeight(d) { return K * d * d; }

  /* Plain decimals only, as typed. A comma is refused (2,5 or 2,500 is
     ambiguous), as are exponents, spaces inside numbers and blanks. */
  function readNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? { ok: true, n: v } : { ok: false, why: 'invalid' };
    var s = String(v == null ? '' : v).trim();
    if (!s) return { ok: false, why: 'missing' };
    if (s.indexOf(',') >= 0) return { ok: false, why: 'comma' };
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return { ok: false, why: 'invalid' };
    return { ok: true, n: Number(s) };
  }
  /* Strictly longer than LIMITS.lengthMaxMm (12,000 mm)? For typed text the
     decimal digits are compared exactly (metres are shifted three places, not
     multiplied), so 12.000001 m and 12000.001 mm are over and 12 m and
     12000 mm are not, whatever floating point would round them to. */
  function overStock(raw, n, unit) {
    var str = typeof raw === 'string' ? raw.trim().replace(/^\+/, '') : null;
    if (str != null && /^(\d+(\.\d*)?|\.\d+)$/.test(str)) {
      var dot = str.indexOf('.');
      var ip = dot < 0 ? str : str.slice(0, dot), fp = dot < 0 ? '' : str.slice(dot + 1);
      if (unit === 'm') { fp = fp + '000'; ip = ip + fp.slice(0, 3); fp = fp.slice(3); }
      ip = ip.replace(/^0+(?=\d)/, '') || '0';
      fp = fp.replace(/0+$/, '');
      var lim = String(LIMITS.lengthMaxMm);
      return ip.length > lim.length || (ip.length === lim.length && ip > lim) || (ip === lim && fp.length > 0);
    }
    return unit === 'm' ? n > LIMITS.lengthMaxMm / 1000 : n > LIMITS.lengthMaxMm;
  }

  function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max); }

  /* input: { ref, diameter, grade, length, lengthUnit ('mm'|'m'), bars,
             actualKg, notes }
     Returns { ok, errors: [codes], warnings: [codes], sample }. */
  function evaluate(input) {
    input = input || {};
    var errors = [], warnings = [];

    var d = readNumber(input.diameter);
    if (!d.ok) errors.push(d.why === 'missing' ? 'diaMissing' : 'diaInvalid');
    else if (d.n < LIMITS.dMin || d.n > LIMITS.dMax) errors.push('diaRange');

    var unit = input.lengthUnit;
    if (unit !== 'mm' && unit !== 'm') errors.push('unit');
    var l = readNumber(input.length), lengthMm = null;
    if (!l.ok) errors.push(l.why === 'missing' ? 'lenMissing' : l.why === 'comma' ? 'lenComma' : 'lenInvalid');
    else if (l.n <= 0) errors.push('lenNotPositive');
    else if (unit === 'm' || unit === 'mm') {
      // Any positive length in the unit the user chose. The unit is never
      // inferred or changed. The only limit is one 12 m stock bar, decided
      // on the value as typed (see overStock), before any rounding.
      lengthMm = unit === 'm' ? l.n * 1000 : l.n;
      if (overStock(input.length, l.n, unit)) errors.push('lenOverStock');
    }

    var b = readNumber(input.bars);
    if (!b.ok) errors.push(b.why === 'missing' ? 'barsMissing' : 'barsInvalid');
    else if (Math.floor(b.n) !== b.n) errors.push('barsFraction');
    else if (b.n < 1 || b.n > LIMITS.barsMax) errors.push('barsRange');

    var a = readNumber(input.actualKg);
    if (!a.ok) errors.push(a.why === 'missing' ? 'kgMissing' : a.why === 'comma' ? 'kgComma' : 'kgInvalid');
    else if (a.n <= 0) errors.push('kgNotPositive');
    else if (a.n > LIMITS.kgMax) errors.push('kgRange');

    if (errors.length) return { ok: false, errors: errors, warnings: warnings };

    var uw = unitWeight(d.n);
    var perBar = uw * lengthMm / 1000;
    var theo = perBar * b.n;
    var diff = a.n - theo;
    var dev = diff / theo * 100;

    if (AL_RAJHI_SIZES.indexOf(d.n) < 0) warnings.push('nonStandard');
    // a gap over 25% almost always means a typing slip (unit, bar count or
    // diameter). It asks the user to re-check the inputs; it says nothing
    // about the steel and is not an acceptance limit.
    if (Math.abs(dev) > 25) warnings.push('inputCheck');

    return {
      ok: true, errors: errors, warnings: warnings,
      sample: {
        ref: clean(input.ref, LIMITS.text), grade: clean(input.grade, 20), notes: clean(input.notes, LIMITS.notes),
        diameter: d.n, standardSize: AL_RAJHI_SIZES.indexOf(d.n) >= 0,
        lengthInput: l.n, lengthUnit: unit, lengthMm: lengthMm, bars: b.n,
        unitWeight: uw, theoreticalPerBarKg: perBar, theoreticalKg: theo,
        actualKg: a.n, actualPerMetreKg: a.n / (lengthMm / 1000 * b.n),
        differenceKg: diff, deviationPct: dev, warnings: warnings
      }
    };
  }

  /* User-defined range, in %: lower <= deviation <= upper, both inclusive.
     Either bound may be left empty; both empty means no comparison. */
  function readTolerance(lower, upper) {
    var lo = String(lower == null ? '' : lower).trim(), up = String(upper == null ? '' : upper).trim();
    if (!lo && !up) return { ok: true, tol: null };
    var errors = [], t = { lower: null, upper: null };
    if (lo) { var l = readNumber(lo); if (!l.ok) errors.push('tolLowerInvalid'); else if (l.n > 0) errors.push('tolLowerSign'); else if (l.n < -LIMITS.tolAbsMax) errors.push('tolRange'); else t.lower = l.n; }
    if (up) { var u = readNumber(up); if (!u.ok) errors.push('tolUpperInvalid'); else if (u.n < 0) errors.push('tolUpperSign'); else if (u.n > LIMITS.tolAbsMax) errors.push('tolRange'); else t.upper = u.n; }
    if (errors.length) return { ok: false, errors: errors };
    return { ok: true, tol: t };
  }

  /* 'inside' | 'outside' | null (no range entered). Inclusive bounds; the
     comparison uses the unrounded deviation. Only a comparison with the
     user's own numbers. */
  function compare(dev, tol) {
    if (!tol || (tol.lower == null && tol.upper == null)) return null;
    if (tol.lower != null && dev < tol.lower) return 'outside';
    if (tol.upper != null && dev > tol.upper) return 'outside';
    return 'inside';
  }

  /* Samples of the same diameter can be pooled: their weights are of the
     same nominal mass per metre, so the combined deviation is meaningful.
     The smallest and largest individual deviations are kept beside it so
     nothing is averaged away. Across diameters only the total masses are
     added; no combined deviation is given. */
  function summarise(samples) {
    var by = {}, order = [];
    var tot = { samples: 0, theoreticalKg: 0, actualKg: 0 };
    samples.forEach(function (s) {
      var k = String(s.diameter);
      if (!by[k]) { by[k] = { diameter: s.diameter, samples: 0, bars: 0, lengthM: 0, theoreticalKg: 0, actualKg: 0, minDev: Infinity, maxDev: -Infinity }; order.push(k); }
      var g = by[k];
      g.samples++; g.bars += s.bars; g.lengthM += s.lengthMm * s.bars / 1000;
      g.theoreticalKg += s.theoreticalKg; g.actualKg += s.actualKg;
      g.minDev = Math.min(g.minDev, s.deviationPct); g.maxDev = Math.max(g.maxDev, s.deviationPct);
      tot.samples++; tot.theoreticalKg += s.theoreticalKg; tot.actualKg += s.actualKg;
    });
    var groups = order.map(function (k) {
      var g = by[k];
      g.differenceKg = g.actualKg - g.theoreticalKg;
      g.deviationPct = g.differenceKg / g.theoreticalKg * 100;
      return g;
    }).sort(function (a, b) { return a.diameter - b.diameter; });
    tot.differenceKg = tot.actualKg - tot.theoreticalKg;
    tot.diameters = groups.length;
    // a combined percentage is given only when every sample has one diameter
    tot.deviationPct = groups.length === 1 ? groups[0].deviationPct : null;
    return { byDiameter: groups, totals: tot };
  }

  /* CSV, safe to open in Excel: a text cell that starts with = + - @ | or a
     control character is prefixed with an apostrophe; plain numbers are left
     alone. */
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r|]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(table) { return '﻿' + table.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'); }

  function csvTable(samples, tol) {
    var rows = [['Individual samples'],
      ['Reference', 'Diameter mm', 'Grade (informational)', 'Length mm', 'Bars', 'Unit weight kg/m', 'Theoretical kg', 'Measured kg',
      'Difference kg', 'Sample deviation %', 'Within entered range', 'Notes']];
    samples.forEach(function (s) {
      var c = compare(s.deviationPct, tol);
      rows.push([s.ref, s.diameter, s.grade, s.lengthMm, s.bars, s.unitWeight.toFixed(6), s.theoreticalKg.toFixed(4), s.actualKg,
        s.differenceKg.toFixed(4), s.deviationPct.toFixed(3), c == null ? '' : (c === 'inside' ? 'inside' : 'outside'), s.notes]);
    });
    var sum = summarise(samples);
    rows.push([]);
    rows.push(['Pooled by nominal diameter: (sum measured - sum theoretical) / sum theoretical x 100, same diameter only']);
    rows.push(['', 'Diameter mm', 'Samples', 'Bars', 'Length m', 'Theoretical kg', 'Measured kg', 'Difference kg', 'Pooled deviation %', 'Lowest sample deviation %', 'Highest sample deviation %']);
    sum.byDiameter.forEach(function (g) {
      rows.push(['', g.diameter, g.samples, g.bars, g.lengthM.toFixed(3), g.theoreticalKg.toFixed(4), g.actualKg.toFixed(4), g.differenceKg.toFixed(4),
        g.deviationPct.toFixed(3), g.minDev.toFixed(3), g.maxDev.toFixed(3)]);
    });
    rows.push([]);
    var t = sum.totals;
    rows.push(['Total masses, all samples (no combined deviation across different diameters)', '', t.samples, '', '', t.theoreticalKg.toFixed(4), t.actualKg.toFixed(4), t.differenceKg.toFixed(4)]);
    rows.push([]);
    if (tol) rows.push(['Entered range %', tol.lower == null ? '' : tol.lower, tol.upper == null ? '' : tol.upper, 'Comparison with the entered range only, not a compliance decision']);
    rows.push(['Formula', 'Unit weight = 0.006165 x d^2 kg/m (nominal; same for Grade 60 and Grade 80). Deviation % = (actual - theoretical) / theoretical x 100']);
    rows.push(['Note', 'Theoretical comparison only. Not a mill test certificate (MTC). Not a laboratory test. Not a certification of steel quality. A deviation alone does not prove non-compliance. mashharawi.com']);
    return rows;
  }

  return {
    evaluate: evaluate, readTolerance: readTolerance, compare: compare, summarise: summarise, unitWeight: unitWeight,
    readNumber: readNumber, csvCell: csvCell, toCsv: toCsv, csvTable: csvTable, SIZES: AL_RAJHI_SIZES, LIMITS: LIMITS, K: K
  };
});
