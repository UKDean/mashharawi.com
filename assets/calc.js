/* ==========================================================================
   mashharawi.com, reinforcing steel weight calculator
   --------------------------------------------------------------------------
   Nominal mass per metre of a round bar:

       m = (pi / 4) * d^2 * rho / 1e6        d in mm, rho in kg/m3
         = (pi / 4) * d^2 * 7850 / 1e6
         = 0.0061654... * d^2               kg/m

   The industry constant 0.006165 is that expression rounded. This file uses
   the full expression so the figures do not drift on large tonnages, and
   shows the rounded constant in the interface because that is the number
   people recognise.

   Everything here is NOMINAL mass. Delivered mass sits inside the tolerance
   band of whichever standard governs the order, which is a separate and
   commercially significant matter, the page links to a note on that.

   Language is read from the document, so one file serves /  and /ar/.
   Digits stay Western in both, because that is what invoices and mill
   certificates use.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('calc');
  if (!root) return;

  var RHO = 7850;                       // kg/m3, the density assumed by the standards
  var K = Math.PI / 4 * RHO / 1e6;      // 0.00616689... kg/m per mm^2
  var AR = document.documentElement.getAttribute('dir') === 'rtl';

  var T = AR ? {
    pieces: 'سيخ', line: 'بند', dia: 'القطر', len: 'الطول', qty: 'العدد',
    wt: 'الوزن', total: 'الإجمالي', copied: 'تم النسخ', copy: 'نسخ الجدول',
    empty: 'أضف بنداً لبناء أمر التوريد.', remove: 'حذف البند',
    head: ['القطر (مم)', 'الطول (م)', 'العدد', 'الوزن (كجم)', 'الوزن (طن)']
  } : {
    pieces: 'bars', line: 'line', dia: 'Diameter', len: 'Length', qty: 'Pieces',
    wt: 'Weight', total: 'Total', copied: 'Copied', copy: 'Copy table',
    empty: 'Add a line to build an order.', remove: 'Remove line',
    head: ['Diameter (mm)', 'Length (m)', 'Pieces', 'Weight (kg)', 'Weight (t)']
  };

  /* ---- helpers ----------------------------------------------------------- */
  function massPerMetre(d) { return K * d * d; }
  function fmt(n, dp) {
    if (!isFinite(n)) return '0';
    return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  function $(id) { return document.getElementById(id); }

  /* Animated counters. A figure that slides to its new value shows that the
     page is computing, not just re-rendering. Skipped under reduced motion. */
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setFig(el, value, dp) {
    if (!el) return;
    var from = parseFloat(el.getAttribute('data-v'));
    el.setAttribute('data-v', value);
    if (REDUCE || !isFinite(from) || from === value) { el.textContent = fmt(value, dp); return; }
    var t0 = performance.now(), dur = 420;
    if (el._raf) cancelAnimationFrame(el._raf);
    if (el._safety) clearTimeout(el._safety);

    /* requestAnimationFrame is throttled, sometimes to nothing, in a
       background tab or a heavily nested frame. Without a backstop the
       counter can be abandoned mid-flight and leave a number on screen that
       is not the number that was computed. A wrong figure is worse than no
       animation, so a timer forces the final value regardless. */
    el._safety = setTimeout(function () {
      if (el._raf) cancelAnimationFrame(el._raf);
      el._raf = 0; el._safety = 0;
      el.textContent = fmt(parseFloat(el.getAttribute('data-v')), dp);
    }, dur + 80);

    (function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (value - from) * e, dp);
      if (p < 1) el._raf = requestAnimationFrame(step);
      else {
        el._raf = 0;
        if (el._safety) { clearTimeout(el._safety); el._safety = 0; }
        el.textContent = fmt(value, dp);
      }
    })(t0);
  }

  /* ---- state ------------------------------------------------------------- */
  var dia = 16, len = 12, qty = 100;
  var order = [];

  var elDia = $('cDiaVal'), elLen = $('cLen'), elQty = $('cQty');
  var elChips = root.querySelectorAll('.calc-chip');
  var elCustom = $('cCustom');
  var svgScale = $('cSection');
  var elRows = $('cRows'), elEmpty = $('cEmpty');

  /* ---- the cross-section drawing ---------------------------------------- */
  /* r is fixed in the SVG; the group is scaled, because CSS transforms are
     supported everywhere while CSS geometry properties are not. */
  function drawSection() {
    if (!svgScale) return;
    var s = (0.30 + (Math.min(40, Math.max(6, dia)) - 6) / 34 * 0.70);
    svgScale.style.transform = 'scale(' + s.toFixed(4) + ')';
    if (elDia) elDia.textContent = dia;
  }

  /* ---- render ------------------------------------------------------------ */
  function render() {
    var mpm = massPerMetre(dia);
    var perBar = mpm * len;
    var totalKg = perBar * qty;

    setFig($('oMpm'), mpm, 3);
    setFig($('oBar'), perBar, 2);
    setFig($('oTot'), totalKg / 1000, 3);
    setFig($('oPerT'), perBar > 0 ? 1000 / perBar : NaN, 1);

    var barLbl = $('oBarLbl');
    if (barLbl) barLbl.textContent = AR ? ('لكل سيخ ' + len + ' م') : ('Per ' + len + ' m bar');

    drawSection();
    renderOrder();
  }

  function renderOrder() {
    if (!elRows) return;
    elRows.textContent = '';
    var tk = 0, tp = 0;

    order.forEach(function (r, i) {
      var mpm = massPerMetre(r.d);
      var kg = mpm * r.l * r.q;
      tk += kg; tp += r.q;

      var tr = document.createElement('tr');
      tr.className = 'calc-row-in';
      cell(tr, String(r.d), 'num');
      cell(tr, fmt(r.l, r.l % 1 ? 2 : 0), 'num');
      cell(tr, fmt(r.q, 0), 'num');
      cell(tr, fmt(kg, 1), 'num');
      cell(tr, fmt(kg / 1000, 3), 'num strong');

      var td = document.createElement('td');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'calc-x';
      b.setAttribute('aria-label', T.remove + ' ' + (i + 1));
      b.textContent = '×';
      b.addEventListener('click', function () { order.splice(i, 1); renderOrder(); });
      td.appendChild(b);
      tr.appendChild(td);
      elRows.appendChild(tr);
    });

    if (elEmpty) elEmpty.hidden = order.length > 0;
    var tbl = root.querySelector('.calc-table');
    if (tbl) tbl.hidden = order.length === 0;

    setFig($('tPieces'), tp, 0);
    setFig($('tKg'), tk, 1);
    setFig($('tT'), tk / 1000, 3);
  }

  function cell(tr, text, cls) {
    var td = document.createElement('td');
    if (cls) td.className = cls;
    td.textContent = text;
    tr.appendChild(td);
    return td;
  }

  /* ---- inputs ------------------------------------------------------------ */
  function selectChip(v) {
    dia = v;
    elChips.forEach(function (c) {
      var on = parseFloat(c.getAttribute('data-d')) === v;
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (elCustom) elCustom.value = '';
    render();
  }

  elChips.forEach(function (c) {
    c.addEventListener('click', function () { selectChip(parseFloat(c.getAttribute('data-d'))); });
  });

  if (elCustom) {
    elCustom.addEventListener('input', function () {
      var v = parseFloat(elCustom.value);
      if (isFinite(v) && v > 0 && v <= 100) {
        dia = v;
        elChips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        render();
      }
    });
  }

  if (elLen) {
    elLen.addEventListener('input', function () {
      var v = parseFloat(elLen.value);
      len = isFinite(v) && v > 0 ? v : 0;
      render();
    });
  }

  if (elQty) {
    elQty.addEventListener('input', function () {
      var v = parseInt(elQty.value, 10);
      qty = isFinite(v) && v > 0 ? v : 0;
      render();
    });
  }

  /* Tonnes in, pieces out. This is the conversion that actually gets asked
     for: a buyer has a tonnage and needs to know how many bars that is. The
     answer has to be a whole number of bars, so the tonnage is restated as
     what those bars actually weigh. */
  var elTon = $('cTon');
  if (elTon) {
    elTon.addEventListener('input', function () {
      var t = parseFloat(elTon.value);
      var perBar = massPerMetre(dia) * len;
      if (!isFinite(t) || t <= 0 || perBar <= 0) return;
      qty = Math.max(1, Math.round(t * 1000 / perBar));
      if (elQty) elQty.value = qty;
      render();
      var hint = $('cTonHint');
      if (hint) {
        var actual = qty * perBar / 1000;
        hint.textContent = AR
          ? (fmt(qty, 0) + ' سيخ = ' + fmt(actual, 3) + ' طن')
          : (fmt(qty, 0) + ' bars = ' + fmt(actual, 3) + ' t');
      }
    });
  }

  var add = $('cAdd');
  if (add) {
    add.addEventListener('click', function () {
      if (!(dia > 0 && len > 0 && qty > 0)) return;
      order.push({ d: dia, l: len, q: qty });
      renderOrder();
    });
  }

  var copy = $('cCopy');
  if (copy) {
    copy.addEventListener('click', function () {
      var lines = [T.head.join('\t')];
      var tk = 0;
      order.forEach(function (r) {
        var kg = massPerMetre(r.d) * r.l * r.q;
        tk += kg;
        lines.push([r.d, r.l, r.q, kg.toFixed(1), (kg / 1000).toFixed(3)].join('\t'));
      });
      lines.push([T.total, '', '', tk.toFixed(1), (tk / 1000).toFixed(3)].join('\t'));
      lines.push('');
      lines.push(AR ? 'أوزان نظرية (m = 0.006165 × d²). الوزن المورّد يقع داخل حدود السماحية المعتمدة.'
                    : 'Nominal weights (m = 0.006165 x d^2). Delivered weight sits inside the governing tolerance band.');
      var text = lines.join('\n');
      var done = function () {
        var old = copy.textContent;
        copy.textContent = T.copied;
        copy.classList.add('ok');
        setTimeout(function () { copy.textContent = old; copy.classList.remove('ok'); }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  }

  /* ---- go ---------------------------------------------------------------- */
  if (elLen) elLen.value = len;
  if (elQty) elQty.value = qty;
  selectChip(dia);
})();
