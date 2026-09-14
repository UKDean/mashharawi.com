/* ==========================================================================
   mashharawi.com, structural steel section weight calculator
   --------------------------------------------------------------------------
   The browser version of the Steel Section Calculator app. Same numbers, same
   assumptions, same accuracy notice.

   Weight is never stored. Every figure on this page is computed from the
   section's nominal geometry:

       area (cm2) -> mass per metre = area * 1e-4 m2 * 7850 kg/m3

   The area formulas below are ports of the app's `lib/domain/calculators/`
   files, one for one, and each notes the file it came from. Porting rather
   than re-deriving is deliberate: two implementations that drift apart would
   be worse than no web version at all, so the shapes of the formulas are kept
   identical and the tables are copied verbatim by tools/build_sections.py.

   The dimension tables themselves carry a per-size `verified` flag, straight
   from the app. Unverified sizes are badged in the interface rather than
   quietly presented as fact.

   Language is read from the document, so one file serves /steelcalc/ and
   /ar/steelcalc/. Digits stay Western in both, because that is what invoices
   and mill certificates use.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('scalc');
  if (!root) return;

  var RHO = 7850;                       // kg/m3, the density every mill table assumes
  var AR = document.documentElement.getAttribute('dir') === 'rtl';
  /* Versioned for the same reason the page versions its assets: a cached
     table is a wrong weight, not a stale style. Bump on every rebuild. */
  var DATA_URL = '/assets/data/steel-sections.json?v=20260914';

  /* ---- area formulas, ported from the app ------------------------------- */

  /* domain/calculators/weight.dart */
  function massPerMetre(areaCm2) { return areaCm2 * 1e-4 * RHO; }

  /* domain/calculators/i_beam.dart — two flanges + web, plus the metal the
     four root fillets add. Dropping the fillet term puts an IPE about 4-5%
     light, which is why it is here. */
  function iBeamAreaCm2(d) {
    var flanges = 2 * d.b * d.tf;
    var web = (d.h - 2 * d.tf) * d.tw;
    var fillets = (4 - Math.PI) * d.r * d.r;
    return (flanges + web + fillets) / 100;
  }

  /* domain/calculators/channel.dart — same decomposition, but a channel has
     fillets on the inside of the web only, so the correction is half. */
  function channelAreaCm2(d) {
    var flanges = 2 * d.b * d.tf;
    var web = (d.h - 2 * d.tf) * d.tw;
    var fillets = (4 - Math.PI) / 2 * d.r * d.r;
    return (flanges + web + fillets) / 100;
  }

  /* domain/calculators/angle.dart — the legs overlap in a t x t square at the
     corner, hence t*(a+b-t); the root fillet adds metal, the two toe fillets
     take a little away. */
  function angleAreaCm2(d) {
    var legs = d.t * (d.a + d.b - d.t);
    var root_ = (4 - Math.PI) / 4 * d.r1 * d.r1;
    var toes = (4 - Math.PI) / 2 * d.r2 * d.r2;
    return (legs + root_ - toes) / 100;
  }

  /* domain/calculators/bars.dart */
  function roundAreaCm2(d) { return (Math.PI * d.d * d.d / 4) / 100; }
  function squareAreaCm2(d) { return (d.s * d.s) / 100; }
  function hexAreaCm2(d) { return ((Math.sqrt(3) / 2) * d.w * d.w) / 100; }
  function flatAreaCm2(d) { return (d.width * d.thickness) / 100; }

  /* domain/calculators/hollow.dart — `exact` subtracts the wall from both
     sides and is the true annulus; `quick` is outer perimeter x wall, the
     simplified formula many supplier calculators use, which runs heavier.
     Both are offered because a quote argued against a supplier's number is a
     commercial conversation, not only a geometric one. */
  function pipeAreaCm2(d) {
    var bore = d.od - 2 * d.t;
    if (bore <= 0) return NaN;
    return (Math.PI * d.od * d.od / 4 - Math.PI * bore * bore / 4) / 100;
  }
  function pipeAreaQuickCm2(d) { return (Math.PI * d.od * d.t) / 100; }

  function tubeAreaCm2(d) {
    var iw = d.w - 2 * d.t, ih = d.h - 2 * d.t;
    if (iw <= 0 || ih <= 0) return NaN;
    return (d.w * d.h - iw * ih) / 100;
  }
  function tubeAreaQuickCm2(d) { return (2 * (d.w + d.h) * d.t) / 100; }

  var AREA = {
    ibeam: iBeamAreaCm2, channel: channelAreaCm2, angle: angleAreaCm2,
    round: roundAreaCm2, square: squareAreaCm2, hex: hexAreaCm2, flat: flatAreaCm2,
    pipe: function (d, quick) { return quick ? pipeAreaQuickCm2(d) : pipeAreaCm2(d); },
    tube: function (d, quick) { return quick ? tubeAreaQuickCm2(d) : tubeAreaCm2(d); }
  };

  /* ---- wording ----------------------------------------------------------- */
  /* Arabic follows the app's own lib/l10n/app_ar.arb, so the same section is
     called the same thing in the app and on the site. */
  var T = AR ? {
    size: 'المقاس', len: 'الطول، م', qty: 'العدد', add: 'أضف بنداً', copy: 'نسخ الجدول',
    copied: 'تم النسخ', remove: 'حذف البند', total: 'الإجمالي',
    empty: 'لم يُضف شيء بعد. أضف بنوداً ليظهر إجمالي الأمر هنا.',
    std: 'المعيار', noStd: 'مقاسات سوقية شائعة',
    unverified: 'بيانات غير موثّقة رسمياً: الأبعاد لهذه العائلة لم تُراجع بعد مقابل جدول رسمي معتمد. تحقّق منها قبل الاعتماد عليها في عرض سعر أو شراء.',
    od: 'القطر الخارجي، مم', wall: 'سماكة الجدار، مم', width: 'العرض، مم', height: 'الارتفاع، مم',
    method: 'طريقة الحساب', exact: 'دقيقة', quick: 'سريعة (شائعة تجارياً)',
    exactHint: 'تطرح سماكة الجدار من المقاس الخارجي: دقيقة هندسياً.',
    quickHint: 'المحيط الخارجي × السماكة، بدون طرح: الصيغة المبسطة التي تستخدمها كثير من حاسبات الموردين، وتعطي وزناً أعلى.',
    invalid: 'سماكة الجدار كبيرة جداً بالنسبة لهذا المقاس الخارجي.',
    squareHint: 'للتيوب المربع، استخدم نفس القيمة للعرض والارتفاع.',
    head: ['المقاس', 'الطول (م)', 'العدد', 'الوزن (كجم)', 'الوزن (طن)'],
    orderRange: 'إجمالي الأمر عند سماحية ±{t}%: من {a} إلى {b} طن.',
    fams: {
      ipe: 'IPE', hea: 'HEA', heb: 'HEB', upn: 'UPN',
      angle_equal: 'زاوية متساوية', angle_unequal: 'زاوية غير متساوية',
      bar_round: 'قضيب دائري', bar_square: 'قضيب مربع', bar_hex: 'قضيب سداسي',
      flat: 'حديد مسطح', pipe: 'ماسورة', tube: 'تيوب'
    },
    hints: {
      ipe: 'كمرة بجناح ضيق', hea: 'جناح عريض ورقيق', heb: 'جناح عريض وسميك',
      upn: 'قناة مفتوحة من جهة (شكل U)', angle_equal: 'الساقان بنفس الطول',
      angle_unequal: 'الساقان بطولين مختلفين', bar_round: 'قضيب مصمت',
      bar_square: 'قضيب مصمت', bar_hex: 'القياس بين الوجهين المتقابلين',
      flat: 'شريحة مسطحة', pipe: 'مقطع مجوّف دائري', tube: 'مقطع مجوّف مربع أو مستطيل'
    }
  } : {
    size: 'Size', len: 'Length, m', qty: 'Pieces', add: 'Add this line', copy: 'Copy table',
    copied: 'Copied', remove: 'Remove line', total: 'Total',
    empty: 'Nothing added yet. Build a multi-size order and the totals appear here.',
    std: 'Standard', noStd: 'Common market sizes',
    unverified: 'Unverified data: the dimensions for this family have not yet been checked against an official reference table. Verify before relying on a figure for a quote or a purchase.',
    od: 'Outer diameter, mm', wall: 'Wall thickness, mm', width: 'Width, mm', height: 'Height, mm',
    method: 'Method', exact: 'Exact', quick: 'Quick (common in trade)',
    exactHint: 'Subtracts the wall from the outside dimension: geometrically exact.',
    quickHint: 'Outer perimeter x wall, with nothing subtracted: the simplified formula many supplier calculators use. It runs heavier.',
    invalid: 'The wall is too thick for that outside dimension.',
    squareHint: 'For a square tube, use the same value for width and height.',
    head: ['Size', 'Length (m)', 'Pieces', 'Weight (kg)', 'Weight (t)'],
    orderRange: 'Order total at ±{t}%: {a} to {b} tonnes.',
    fams: {
      ipe: 'IPE', hea: 'HEA', heb: 'HEB', upn: 'UPN',
      angle_equal: 'Equal angle', angle_unequal: 'Unequal angle',
      bar_round: 'Round bar', bar_square: 'Square bar', bar_hex: 'Hex bar',
      flat: 'Flat bar', pipe: 'Pipe', tube: 'Tube'
    },
    hints: {
      ipe: 'Narrow-flange beam', hea: 'Wide flange, thin', heb: 'Wide flange, thick',
      upn: 'Channel, open on one side', angle_equal: 'Legs the same length',
      angle_unequal: 'Legs of different lengths', bar_round: 'Solid bar',
      bar_square: 'Solid bar', bar_hex: 'Measured across the flats',
      flat: 'Flat strip', pipe: 'Hollow, round', tube: 'Hollow, square or rectangular'
    }
  };

  /* ---- helpers ----------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function fmt(n, dp) {
    if (!isFinite(n)) return '0';
    return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* Animated counters, the same treatment the rebar calculator gets: a figure
     that slides shows the page is computing. The timer is a backstop, because
     requestAnimationFrame can be throttled to nothing in a background tab and
     a counter abandoned mid-flight would leave a number on screen that is not
     the number that was computed. */
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setFig(node, value, dp) {
    if (!node) return;
    var from = parseFloat(node.getAttribute('data-v'));
    node.setAttribute('data-v', value);
    if (REDUCE || !isFinite(from) || from === value || !isFinite(value)) {
      node.textContent = fmt(value, dp); return;
    }
    var t0 = performance.now(), dur = 420;
    if (node._raf) cancelAnimationFrame(node._raf);
    if (node._safety) clearTimeout(node._safety);
    node._safety = setTimeout(function () {
      if (node._raf) cancelAnimationFrame(node._raf);
      node._raf = 0; node._safety = 0;
      node.textContent = fmt(parseFloat(node.getAttribute('data-v')), dp);
    }, dur + 80);
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(from + (value - from) * e, dp);
      if (p < 1) node._raf = requestAnimationFrame(step);
      else {
        node._raf = 0;
        if (node._safety) { clearTimeout(node._safety); node._safety = 0; }
        node.textContent = fmt(value, dp);
      }
    })(t0);
  }

  /* ---- the two families the app computes without a bundled table --------- */
  /* Pipe and tube are sold by whatever the supplier rolls, so there is no
     standard size list to ship. They take dimensions directly, exactly like
     the app's manual screen. */
  var MANUAL = [
    { key: 'pipe', shape: 'pipe', standard: '', fields: [
      { id: 'od', label: 'od', value: 60.3, min: 1 },
      { id: 't', label: 'wall', value: 3.6, min: 0.1 }
    ] },
    { key: 'tube', shape: 'tube', standard: '', fields: [
      { id: 'w', label: 'width', value: 60, min: 1 },
      { id: 'h', label: 'height', value: 60, min: 1 },
      { id: 't', label: 'wall', value: 3, min: 0.1 }
    ] }
  ];

  /* ---- cross-section drawing -------------------------------------------- */
  /* Each shape returns an SVG path in millimetres, centred on the origin, plus
     the overall width and height it occupies. The group is then scaled to fit
     the 200 unit box, so a 20 mm angle and a 300 mm beam both read clearly and
     the caption carries the real dimensions. */
  function outline(shape, d) {
    var w, h, p;
    function r(x, y, ww, hh) {  /* rectangle as a closed path */
      return 'M' + x + ' ' + y + 'h' + ww + 'v' + hh + 'h' + (-ww) + 'Z';
    }
    if (shape === 'ibeam' || shape === 'channel') {
      w = d.b; h = d.h;
      var x0 = -d.b / 2, y0 = -d.h / 2;
      if (shape === 'ibeam') {
        p = r(x0, y0, d.b, d.tf) +
            r(-d.tw / 2, y0 + d.tf, d.tw, d.h - 2 * d.tf) +
            r(x0, d.h / 2 - d.tf, d.b, d.tf);
      } else {                                  /* U, open to the trailing side */
        p = r(x0, y0, d.b, d.tf) +
            r(x0, y0 + d.tf, d.tw, d.h - 2 * d.tf) +
            r(x0, d.h / 2 - d.tf, d.b, d.tf);
      }
    } else if (shape === 'angle') {
      w = d.b; h = d.a;
      p = 'M' + (-d.b / 2) + ' ' + (-d.a / 2) + 'h' + d.t + 'v' + (d.a - d.t) +
          'h' + (d.b - d.t) + 'v' + d.t + 'h' + (-d.b) + 'Z';
    } else if (shape === 'round') {
      w = h = d.d;
      p = 'M' + (-d.d / 2) + ' 0a' + (d.d / 2) + ' ' + (d.d / 2) + ' 0 1 0 ' + d.d +
          ' 0a' + (d.d / 2) + ' ' + (d.d / 2) + ' 0 1 0 ' + (-d.d) + ' 0Z';
    } else if (shape === 'square') {
      w = h = d.s; p = r(-d.s / 2, -d.s / 2, d.s, d.s);
    } else if (shape === 'hex') {
      /* across-flats w, so the corner-to-corner span is w * 2/sqrt(3) */
      var a = d.w / Math.sqrt(3), pts = [];
      for (var i = 0; i < 6; i++) {
        var ang = Math.PI / 180 * (60 * i);
        pts.push((a * Math.cos(ang)).toFixed(2) + ' ' + (a * Math.sin(ang)).toFixed(2));
      }
      w = 2 * a; h = d.w; p = 'M' + pts.join('L') + 'Z';
    } else if (shape === 'flat') {
      w = d.width; h = d.thickness; p = r(-d.width / 2, -d.thickness / 2, d.width, d.thickness);
    } else if (shape === 'pipe') {
      w = h = d.od;
      var ri = d.od / 2 - d.t;
      p = 'M' + (-d.od / 2) + ' 0a' + (d.od / 2) + ' ' + (d.od / 2) + ' 0 1 0 ' + d.od +
          ' 0a' + (d.od / 2) + ' ' + (d.od / 2) + ' 0 1 0 ' + (-d.od) + ' 0Z';
      if (ri > 0) {
        p += 'M' + (-ri) + ' 0a' + ri + ' ' + ri + ' 0 1 0 ' + (2 * ri) +
             ' 0a' + ri + ' ' + ri + ' 0 1 0 ' + (-2 * ri) + ' 0Z';
      }
    } else {                                     /* tube */
      w = d.w; h = d.h;
      p = r(-d.w / 2, -d.h / 2, d.w, d.h);
      if (d.w - 2 * d.t > 0 && d.h - 2 * d.t > 0) {
        p += r(-d.w / 2 + d.t, -d.h / 2 + d.t, d.w - 2 * d.t, d.h - 2 * d.t);
      }
    }
    return { d: p, w: w, h: h };
  }

  /* ---- state ------------------------------------------------------------- */
  var families = [];        /* table families from the JSON, then the manual two */
  var fam = null;           /* selected family */
  var sizeIndex = 0;
  var manual = {};          /* dimensions for pipe / tube, per family key */
  var quick = false;        /* hollow: quick formula instead of exact */
  var len = 6, qty = 100;
  var tol = 4;              /* commercial tolerance, ±%, editable on the page */
  var order = [];

  var elChips = $('sFams'), elSize = $('sSize'), elSizeWrap = $('sSizeWrap');
  var elManual = $('sManual'), elMethod = $('sMethod'), elStd = $('sStd');
  var elUnver = $('sUnver'), elPath = $('sPath'), elShape = $('sShape');
  var elDims = $('sDims'), elRows = $('sRows'), elEmpty = $('sEmpty');
  var elTable = root.querySelector('.calc-table');

  MANUAL.forEach(function (m) {
    manual[m.key] = {};
    m.fields.forEach(function (f) { manual[m.key][f.id] = f.value; });
  });

  /* ---- current section --------------------------------------------------- */
  function current() {
    if (!fam) return null;
    if (fam.manual) {
      return { dims: manual[fam.key], designation: designationOf(fam), verified: true };
    }
    var s = fam.sizes[Math.min(sizeIndex, fam.sizes.length - 1)];
    return { dims: s, designation: s.designation, verified: s.verified };
  }

  function designationOf(f) {
    var m = manual[f.key];
    return f.key === 'pipe'
      ? 'Ø' + m.od + ' x ' + m.t + ' mm'
      : m.w + 'x' + m.h + 'x' + m.t + ' mm';
  }

  function areaOf(sec) {
    var fn = AREA[fam.shape];
    return fam.manual ? fn(sec.dims, quick) : fn(sec.dims);
  }

  /* ---- render ------------------------------------------------------------ */
  function render() {
    var sec = current();
    if (!sec) return;

    var area = areaOf(sec);
    var bad = !isFinite(area) || area <= 0;
    var mpm = bad ? NaN : massPerMetre(area);
    var perPiece = mpm * len;

    setFig($('oMpm'), bad ? 0 : mpm, 3);
    setFig($('oPiece'), bad ? 0 : perPiece, 2);
    setFig($('oPerT'), bad || perPiece <= 0 ? 0 : 1000 / perPiece, 1);
    setFig($('oTot'), bad ? 0 : perPiece * qty / 1000, 3);

    /* Commercial weight. A mill delivers inside the mass tolerance of the
       governing standard, so the invoice sits somewhere in a band around the
       nominal figure, not on it. The band is what a buyer or a seller is
       actually exposed to, which is why it is shown in tonnes rather than as
       a percentage the reader has to apply themselves. */
    var totalT = bad ? 0 : perPiece * qty / 1000;
    var lo = totalT * (1 - tol / 100), hi = totalT * (1 + tol / 100);
    setFig($('oMin'), lo, 3);
    setFig($('oNom'), totalT, 3);
    setFig($('oMax'), hi, 3);
    setFig($('oSpread'), hi - lo, 3);

    var warn = $('sWarn');
    if (warn) { warn.textContent = bad ? T.invalid : ''; warn.hidden = !bad; }

    if (elUnver) elUnver.hidden = sec.verified;
    if (elDims) elDims.textContent = sec.designation;

    drawSection(sec);

    var addBtn = $('sAdd');
    if (addBtn) addBtn.disabled = bad;
  }

  function drawSection(sec) {
    if (!elPath || !elShape) return;
    var o = outline(fam.shape, sec.dims);
    elPath.setAttribute('d', o.d);
    var span = Math.max(o.w, o.h) || 1;
    var s = 150 / span;
    elShape.setAttribute('transform', 'translate(100 100) scale(' + s.toFixed(4) + ')');
  }

  /* ---- controls ---------------------------------------------------------- */
  function buildChips() {
    families.forEach(function (f) {
      var b = el('button', 'calc-chip', T.fams[f.key] || f.key);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.title = T.hints[f.key] || '';
      b.addEventListener('click', function () { selectFamily(f); });
      f._chip = b;
      elChips.appendChild(b);
    });
  }

  function selectFamily(f) {
    fam = f;
    sizeIndex = 0;
    families.forEach(function (o) {
      if (o._chip) o._chip.setAttribute('aria-pressed', String(o === f));
    });

    if (elStd) elStd.textContent = (T.hints[f.key] ? T.hints[f.key] + ' · ' : '') +
      (f.standard ? T.std + ': ' + f.standard : T.noStd);

    if (f.manual) {
      elSizeWrap.hidden = true;
      buildManual(f);
      elManual.hidden = false;
      elMethod.hidden = false;
    } else {
      elManual.hidden = true;
      elMethod.hidden = true;
      elSizeWrap.hidden = false;
      elSize.innerHTML = '';
      f.sizes.forEach(function (s, i) {
        var opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = s.designation + (s.verified ? '' : ' *');
        elSize.appendChild(opt);
      });
      elSize.value = '0';
    }
    render();
  }

  function buildManual(f) {
    elManual.innerHTML = '';
    f.fields.forEach(function (fd) {
      var lab = el('label', 'calc-field');
      lab.appendChild(el('span', null, T[fd.label]));
      var inp = document.createElement('input');
      inp.type = 'number'; inp.min = String(fd.min); inp.step = '0.1';
      inp.inputMode = 'decimal';
      inp.value = String(manual[f.key][fd.id]);
      inp.addEventListener('input', function () {
        var v = parseFloat(inp.value);
        if (isFinite(v) && v > 0) { manual[f.key][fd.id] = v; render(); }
      });
      lab.appendChild(inp);
      elManual.appendChild(lab);
    });
    var hint = $('sManualHint');
    if (hint) hint.textContent = f.key === 'tube' ? T.squareHint : '';
  }

  /* ---- order ------------------------------------------------------------- */
  function addLine() {
    var sec = current();
    if (!sec) return;
    var area = areaOf(sec);
    if (!isFinite(area) || area <= 0) return;
    var kg = massPerMetre(area) * len * qty;
    order.push({ designation: sec.designation, len: len, qty: qty, kg: kg });
    drawOrder(true);
  }

  function drawOrder(animateLast) {
    if (!elRows) return;
    elRows.innerHTML = '';
    var pieces = 0, kg = 0;

    order.forEach(function (line, i) {
      pieces += line.qty; kg += line.kg;
      var tr = el('tr', i === order.length - 1 && animateLast ? 'calc-row-in' : null);
      tr.appendChild(el('td', null, line.designation));
      tr.appendChild(el('td', 'num', fmt(line.len, 1)));
      tr.appendChild(el('td', 'num', fmt(line.qty, 0)));
      tr.appendChild(el('td', 'num', fmt(line.kg, 1)));
      tr.appendChild(el('td', 'num strong', fmt(line.kg / 1000, 3)));
      var x = el('td');
      var btn = el('button', 'calc-x', '×');
      btn.type = 'button';
      btn.setAttribute('aria-label', T.remove);
      btn.addEventListener('click', function () { order.splice(i, 1); drawOrder(false); });
      x.appendChild(btn);
      tr.appendChild(x);
      elRows.appendChild(tr);
    });

    if (elEmpty) elEmpty.hidden = order.length > 0;
    if (elTable) elTable.hidden = order.length === 0;
    setFig($('tPieces'), pieces, 0);
    setFig($('tKg'), kg, 1);
    setFig($('tT'), kg / 1000, 3);

    var range = $('sOrderTol');
    if (range) {
      var t = kg / 1000;
      range.hidden = order.length === 0;
      range.textContent = T.orderRange
        .replace('{t}', fmt(tol, 1))
        .replace('{a}', fmt(t * (1 - tol / 100), 3))
        .replace('{b}', fmt(t * (1 + tol / 100), 3));
    }
  }

  function copyTable() {
    if (!order.length) return;
    var lines = [T.head.join('\t')];
    order.forEach(function (l) {
      lines.push([l.designation, fmt(l.len, 1), fmt(l.qty, 0),
                  fmt(l.kg, 1), fmt(l.kg / 1000, 3)].join('\t'));
    });
    var total = order.reduce(function (a, l) { return a + l.kg; }, 0);
    lines.push([T.total, '', '', fmt(total, 1), fmt(total / 1000, 3)].join('\t'));

    var text = lines.join('\n');
    var btn = $('sCopy'), was = btn ? btn.textContent : '';
    function done() {
      if (!btn) return;
      btn.textContent = T.copied; btn.classList.add('ok');
      setTimeout(function () { btn.textContent = was; btn.classList.remove('ok'); }, 1400);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else { fallback(); }

    /* Clipboard access is refused outside a secure context and in some
       embedded browsers, so the old selection path stays as a fallback rather
       than the button appearing to do nothing. */
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* nothing to do */ }
      document.body.removeChild(ta);
    }
  }

  /* ---- wiring ------------------------------------------------------------ */
  function bind() {
    if (elSize) elSize.addEventListener('change', function () {
      sizeIndex = parseInt(elSize.value, 10) || 0; render();
    });

    var elLen = $('sLen'), elQty = $('sQty');
    if (elLen) {
      elLen.value = String(len);
      elLen.addEventListener('input', function () {
        var v = parseFloat(elLen.value);
        if (isFinite(v) && v > 0) { len = v; render(); }
      });
    }
    if (elQty) {
      elQty.value = String(qty);
      elQty.addEventListener('input', function () {
        var v = parseInt(elQty.value, 10);
        if (isFinite(v) && v > 0) { qty = v; render(); }
      });
    }

    var elTol = $('sTol');
    if (elTol) {
      elTol.value = String(tol);
      elTol.addEventListener('input', function () {
        var v = parseFloat(elTol.value);
        /* An empty or negative field means the reader is mid-edit, not that
           the tolerance is zero; the last good value stays until it is. */
        if (isFinite(v) && v >= 0 && v <= 15) { tol = v; render(); drawOrder(false); }
      });
    }

    root.querySelectorAll('[data-method]').forEach(function (b) {
      b.addEventListener('click', function () {
        quick = b.getAttribute('data-method') === 'quick';
        root.querySelectorAll('[data-method]').forEach(function (o) {
          o.setAttribute('aria-pressed', String((o.getAttribute('data-method') === 'quick') === quick));
        });
        var h = $('sMethodHint');
        if (h) h.textContent = quick ? T.quickHint : T.exactHint;
        render();
      });
    });

    var add = $('sAdd'), copy = $('sCopy');
    if (add) { add.textContent = T.add; add.addEventListener('click', addLine); }
    if (copy) { copy.textContent = T.copy; copy.addEventListener('click', copyTable); }
  }

  /* ---- start ------------------------------------------------------------- */
  fetch(DATA_URL)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      families = data.families.slice();
      MANUAL.forEach(function (m) {
        families.push({ key: m.key, shape: m.shape, standard: '', manual: true, fields: m.fields });
      });
      buildChips();
      bind();
      selectFamily(families[0]);
      root.removeAttribute('data-loading');
    })
    .catch(function () {
      /* A calculator that cannot load its tables must say so rather than sit
         there showing zeros, which would read as a weightless section. */
      var f = $('sFail');
      if (f) f.hidden = false;
      root.removeAttribute('data-loading');
    });
})();
