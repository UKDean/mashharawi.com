/* ==========================================================================
   mashharawi.com, Steel Weight Verification: the page
   --------------------------------------------------------------------------
   UI only; every number comes from engine.js (SwvEngine). Text: i18n.js.
   Nothing is uploaded or stored: the session lives in the `session` array in
   this tab and is gone when the page closes. No accounts. Values typed by
   the visitor are written back with textContent only. WhatsApp opens only
   after an explicit confirmation, and sends nothing by itself.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('swv');
  if (!root || !window.SwvEngine || !window.SwvText) return;
  var E = window.SwvEngine;
  var LANG = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
  var L = LANG.indexOf('ar') === 0 ? 'ar' : (LANG.indexOf('zh') === 0 ? 'zh' : 'en');
  var T = window.SwvText[L];
  var WA = 'https://wa.me/message/D6ABM7QFWVSPB1';
  var GAUGE = 30;                     // the deviation scale shows -30% .. +30%; it is a drawing range, not a limit

  var session = [];                   // evaluated samples, in the order added
  var tol = null;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function fmt(n, dp) { return isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '—'; }
  function sign(n, dp) { var s = fmt(Math.abs(n), dp); return n > 0 ? '+' + s : n < 0 ? '−' + s : s; }
  function say(t, warn) { var m = $('sMsg'); m.textContent = t || ''; m.className = 'co-msg' + (warn ? ' warn' : ''); }

  function input() {
    return {
      ref: $('sRef').value, diameter: $('sDia').value, grade: $('sGrade').value, length: $('sLen').value,
      lengthUnit: $('sUnit').value, bars: $('sBars').value, actualKg: $('sKg').value, notes: $('sNotes').value
    };
  }
  function readTol() {
    var r = E.readTolerance($('tLo').value, $('tUp').value);
    $('tMsg').textContent = r.ok ? '' : r.errors.map(function (c) { return T.err[c]; }).join(' ');
    $('tMsg').className = 'co-msg' + (r.ok ? '' : ' warn');
    tol = r.ok ? r.tol : null;
    return r.ok;
  }
  function verdict(dev) {
    var c = E.compare(dev, tol);
    return c === 'inside' ? T.inside : c === 'outside' ? T.outside : '';
  }

  /* ---- live result for the sample being typed --------------------------- */
  function preview(showErrors) {
    var r = E.evaluate(input());
    readTol();
    if (!r.ok) {
      $('sOut').hidden = true;
      if (showErrors) say(r.errors.map(function (c) { return T.err[c]; }).join(' '), true);
      return null;
    }
    say('');
    var s = r.sample;
    $('sOut').hidden = false;
    $('rTheo').textContent = fmt(s.theoreticalKg, 3);
    $('rAct').textContent = fmt(s.actualKg, 3);
    $('rDiff').textContent = sign(s.differenceKg, 3);
    $('rDev').textContent = sign(s.deviationPct, 2);
    $('rDevNote').textContent = s.deviationPct > 0 ? T.above : s.deviationPct < 0 ? T.below : T.equal;
    $('rUw').textContent = fmt(s.unitWeight, 4) + ' kg/m';
    $('rPerBar').textContent = fmt(s.theoreticalPerBarKg, 3) + ' kg';
    $('rActM').textContent = fmt(s.actualPerMetreKg, 4) + ' kg/m';
    $('rFormula').textContent = '0.006165 × ' + s.diameter + '² = ' + fmt(s.unitWeight, 6) + ' kg/m · ' + fmt(s.lengthMm / 1000, 3) + ' m × ' + s.bars + ' = ' + fmt(s.theoreticalKg, 4) + ' kg · (' + fmt(s.actualKg, 3) + ' − ' + fmt(s.theoreticalKg, 4) + ') ÷ ' + fmt(s.theoreticalKg, 4) + ' × 100 = ' + sign(s.deviationPct, 3) + '%';

    // two bars to scale, and the deviation on a centred scale
    var max = Math.max(s.theoreticalKg, s.actualKg);
    $('barTheo').style.inlineSize = (s.theoreticalKg / max * 100).toFixed(2) + '%';
    $('barAct').style.inlineSize = (s.actualKg / max * 100).toFixed(2) + '%';
    $('barTheoV').textContent = fmt(s.theoreticalKg, 3) + ' kg';
    $('barActV').textContent = fmt(s.actualKg, 3) + ' kg';
    gauge($('gMark'), $('gBand'), s.deviationPct);

    var v = verdict(s.deviationPct);
    var rr = $('rRange');
    rr.textContent = v ? v + ' · ' + T.rangeNote(tol.lower, tol.upper) : T.noRange;
    rr.className = 's-range' + (v === T.outside ? ' out' : v === T.inside ? ' in' : '');
    var w = $('rWarn'); w.textContent = '';
    s.warnings.forEach(function (c) { w.appendChild(el('li', c === 'largeDeviation' ? 'hot' : '', T.warn[c])); });
    w.hidden = !s.warnings.length;
    return s;
  }

  function gauge(mark, band, dev) {
    var clamp = Math.max(-GAUGE, Math.min(GAUGE, dev));
    // logical positions so the Arabic page reads from the same side as the numbers
    mark.style.insetInlineStart = ((clamp + GAUGE) / (2 * GAUGE) * 100).toFixed(2) + '%';
    mark.classList.toggle('clip', clamp !== dev);
    if (tol && (tol.lower != null || tol.upper != null)) {
      var lo = tol.lower == null ? -GAUGE : Math.max(-GAUGE, tol.lower), up = tol.upper == null ? GAUGE : Math.min(GAUGE, tol.upper);
      band.hidden = false;
      band.style.insetInlineStart = ((lo + GAUGE) / (2 * GAUGE) * 100).toFixed(2) + '%';
      band.style.inlineSize = ((up - lo) / (2 * GAUGE) * 100).toFixed(2) + '%';
    } else band.hidden = true;
  }

  ['sRef', 'sDia', 'sGrade', 'sLen', 'sUnit', 'sBars', 'sKg', 'sNotes', 'tLo', 'tUp'].forEach(function (id) {
    $(id).addEventListener('input', function () { preview(false); renderSession(); });
    $(id).addEventListener('change', function () { preview(false); renderSession(); });
  });
  [].forEach.call(root.querySelectorAll('.s-chip'), function (b) {
    b.addEventListener('click', function () { $('sDia').value = b.getAttribute('data-d'); syncChips(); preview(false); });
  });
  $('sDia').addEventListener('input', syncChips);
  function syncChips() {
    [].forEach.call(root.querySelectorAll('.s-chip'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-d') === $('sDia').value.trim())); });
  }

  $('sAdd').addEventListener('click', function () {
    var s = preview(true);
    if (!s) return;
    session.push(s);
    say(T.added(session.length));
    $('sRef').value = ''; $('sKg').value = ''; $('sNotes').value = '';
    $('sOut').hidden = true;
    renderSession();
    $('sKg').focus();
  });
  $('sReset').addEventListener('click', function () {
    ['sRef', 'sLen', 'sBars', 'sKg', 'sNotes'].forEach(function (id) { $(id).value = ''; });
    $('sOut').hidden = true; say('');
  });

  /* ---- the session ------------------------------------------------------- */
  function table(id, head, rows, numFrom) {
    var t = $(id); t.textContent = '';
    var th = el('thead'), tr = el('tr');
    head.forEach(function (h, i) { tr.appendChild(el('th', i >= numFrom ? 'num' : '', h)); });
    th.appendChild(tr); t.appendChild(th);
    var tb = el('tbody');
    rows.forEach(function (r) { tb.appendChild(r); });
    t.appendChild(tb);
  }

  function renderSession() {
    var box = $('sSession');
    box.hidden = !session.length;
    $('sEmpty').hidden = !!session.length;
    if (!session.length) { $('sSum').value = ''; return; }
    var rows = session.map(function (s, i) {
      var tr = el('tr');
      var v = E.compare(s.deviationPct, tol);
      [s.ref || '—', String(s.diameter) + (s.standardSize ? '' : ' *'), s.grade || '—', fmt(s.lengthMm, s.lengthMm % 1 ? 1 : 0) + ' mm', String(s.bars),
        fmt(s.theoreticalKg, 3), fmt(s.actualKg, 3), sign(s.differenceKg, 3), sign(s.deviationPct, 2),
        v == null ? '—' : (v === 'inside' ? T.inside : T.outside)].forEach(function (x, j) {
        var td = el('td', j >= 4 && j <= 8 ? 'num' : '', x);
        if (j === 8) td.className += s.deviationPct < 0 ? ' neg' : s.deviationPct > 0 ? ' pos' : '';
        if (j === 9 && v) td.className = v === 'outside' ? 'out' : 'in';
        tr.appendChild(td);
      });
      var td = el('td'), x = el('button', 'calc-x', '×');
      x.type = 'button'; x.setAttribute('aria-label', '× ' + (s.ref || (i + 1)));
      x.addEventListener('click', function () { session.splice(i, 1); say(T.removed); renderSession(); });
      td.appendChild(x); tr.appendChild(td);
      return tr;
    });
    table('tS', [T.th.ref, T.th.dia, T.th.grade, T.th.len, T.th.bars, T.th.theo, T.th.actual, T.th.diff, T.th.dev, T.th.range, ''], rows, 4);

    var sum = E.summarise(session);
    table('tD', [T.th.dia, T.th.samples, T.th.bars, T.th.lenM, T.th.theo, T.th.actual, T.th.diff, T.th.comb, T.th.low, T.th.high], sum.byDiameter.map(function (g) {
      var tr = el('tr');
      [String(g.diameter), String(g.samples), String(g.bars), fmt(g.lengthM, 3), fmt(g.theoreticalKg, 3), fmt(g.actualKg, 3), sign(g.differenceKg, 3),
        sign(g.deviationPct, 2), sign(g.minDev, 2), sign(g.maxDev, 2)].forEach(function (x, j) { tr.appendChild(el('td', j ? 'num' : '', x)); });
      return tr;
    }), 1);
    var t = sum.totals;
    $('sTotals').textContent = T.totals(t.samples, fmt(t.theoreticalKg, 3), fmt(t.actualKg, 3), sign(t.differenceKg, 3)) +
      (t.deviationPct == null ? '' : ' · ' + sign(t.deviationPct, 2) + '%');
    $('sNoComb').hidden = t.diameters < 2;
    $('sNoComb').textContent = T.noCombined;
    $('sSum').value = summaryText();
    $('sDate').textContent = new Date().toISOString().slice(0, 10);
  }

  function summaryText() {
    var lines = [T.sumHead];
    session.forEach(function (s) {
      var v = E.compare(s.deviationPct, tol);
      lines.push(T.sumLine(s, {
        len: fmt(s.lengthMm / 1000, 3) + ' ' + T.m, theo: fmt(s.theoreticalKg, 3), actual: fmt(s.actualKg, 3), dev: sign(s.deviationPct, 2),
        cmp: v == null ? '' : (v === 'inside' ? T.inside : T.outside)
      }));
    });
    if (tol) lines.push(T.rangeLine(tol.lower, tol.upper));
    lines.push(T.sumFoot);
    return lines.join('\n');
  }

  /* ---- exports ------------------------------------------------------------ */
  $('sCsv').addEventListener('click', function () {
    if (!session.length) return;
    var blob = new Blob([E.toCsv(E.csvTable(session, tol))], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rebar-weight-check-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
  $('sPrint').addEventListener('click', function () { window.print(); });
  function copy(done) {
    var text = $('sSum').value;
    try { navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); }); }
    catch (e) { done(false); }
  }
  $('sCopy').addEventListener('click', function () {
    if (!session.length) return;
    copy(function (ok) { say(ok ? T.copied : T.copyFail, !ok); if (!ok) $('sSum').select(); });
  });
  $('sWa').addEventListener('click', function () {
    if (!session.length) return;
    if (!window.confirm(T.confirmWa)) return;
    copy(function (ok) { say(ok ? T.copied : T.copyFail, !ok); });
    window.open(WA, '_blank', 'noopener');
  });
  $('sClear').addEventListener('click', function () { session = []; say(T.cleared); renderSession(); });

  syncChips();
  renderSession();
})();
