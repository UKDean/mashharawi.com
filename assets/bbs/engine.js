/* ==========================================================================
   mashharawi.com, BBS Analyzer: the analysis engine
   --------------------------------------------------------------------------
   No DOM. Takes a grid of cells (from CSV, a pasted range, manual entry or
   xlsx.js), finds or accepts a column mapping, validates every row, and
   computes quantities and theoretical weights. Runs in the browser
   (window.BbsEngine) and in Node for the tests.

   Rules this file keeps:
   - It never guesses engineering data. A missing or unreadable diameter,
     length or quantity excludes the row and says why. The length unit is
     taken from the column header ("Length (mm)") or from the user; if
     neither says, analysis stops and asks.
   - Every value comes from the sheet as typed. Formula cells carry the
     value Excel saved; those rows are flagged. No formula is evaluated.
   - Weight = 0.006165 x d^2 kg/m (the constant the brief specifies), times
     the cut length, times the number of bars. Theoretical, not measured.
   - Lengths are held in millimetres, rounded to 0.001 mm to remove floating
     point noise from metre-to-millimetre conversion. Totals are summed from
     unrounded row values and rounded only for display.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BbsEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KG_PER_M_PER_MM2 = 0.006165;
  var STANDARD_DIAS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 50];
  // STOCK_MM: business rule. A cut length above one 12 m stock bar cannot be
  // cut from it, so the row is excluded from every total and from the
  // optimizer hand-off. 12,000 mm itself is valid.
  var STOCK_MM = 12000;
  var LIMITS = { rows: 100000, qtyMax: 1000000, dMin: 4, dMax: 60, headerScan: 30, text: 60, stockMm: STOCK_MM };

  function unitWeight(d) { return KG_PER_M_PER_MM2 * d * d; }

  /* ---- delimited text (CSV, TSV, pasted ranges) -------------------------- */
  /* RFC 4180: quoted fields, doubled quotes, newlines inside quotes. The
     delimiter is the one of tab, semicolon and comma that splits the first
     lines most consistently. Returns an array of arrays of strings. */
  function detectDelimiter(text) {
    var sample = text.slice(0, 20000).split(/\r?\n/).filter(function (l) { return l.trim(); }).slice(0, 20);
    var best = ',', bestScore = -1;
    ['\t', ';', ','].forEach(function (d) {
      var counts = sample.map(function (l) { return splitQuoted(l, d).length; });
      if (!counts.length) return;
      var mode = counts.slice().sort(function (a, b) { return a - b; })[Math.floor(counts.length / 2)];
      var same = counts.filter(function (c) { return c === mode; }).length;
      var score = mode > 1 ? same * 100 + mode : 0;
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
  }
  function splitQuoted(line, d) { return parseDelimited(line, d)[0] || []; }

  function parseDelimited(text, delim) {
    text = String(text || '');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var d = delim || detectDelimiter(text);
    var rows = [], row = [], field = '', q = false, i = 0, n = text.length;
    while (i < n) {
      var ch = text[i];
      if (q) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"' && field === '') { q = true; i++; continue; }
      if (ch === d) { row.push(field); field = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') {
        row.push(field); rows.push(row); row = []; field = ''; i++;
        if (rows.length > LIMITS.rows + LIMITS.headerScan) break;
        continue;
      }
      field += ch; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  /* ---- header recognition ------------------------------------------------ */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[ً-ْـ]/g, '')           // Arabic diacritics and tatweel
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه')
      .replace(/\(.*?\)|\[.*?\]|（.*?）/g, '')          // units in brackets are read separately
      .replace(/[\s._\-:/\\#'"’`]+/g, '');
  }

  // Order matters: the first field whose pattern matches a header wins, so
  // the specific names (total length, no. of members) come before the
  // general ones (length, number).
  var FIELDS = [
    ['totalLength', /^(total(cut)?length|tot(al)?len|lengthtotal|الطولالكلي|الطولالاجمالي|اجماليالطول|总长度|总长)$/],
    ['weight', /^(total)?(weight|wt|mass)(kg)?$|^(الوزن|الوزنالكلي|الوزنالاجمالي|重量|总重|总重量)$/],
    ['nMembers', /^(no|number|nr)(of)?(members?|mbrs?|mem)$|^(members|mbrs)$|^(عددالعناصر|عددالاعضاء|构件数|构件数量)$/],
    ['nEach', /^(no|number|nr)?(in|per)?each$|^(nopermember|barspermember|noineach|عددفيكلعنصر|العددفيكلعنصر|每件根数|每构件根数|单件根数)$/],
    ['qty', /^(total)?(no|nos|number|qty|quantity|pcs|pieces|bars|count)(of)?(bars|pcs|pieces)?(total)?$|^(totalno|totalnumber|totalqty|totalbars|العدد|الكميه|العددالكلي|عدد|عددالاسياخ|عددالقطع|数量|根数|总根数)$/],
    ['mark', /^(bar)?(mark|marks|markno|ref|reference|barno|barnumber|barref)$|^(رقمالسيخ|العلامه|علامه|علامهالسيخ|رمزالسيخ|رقمالعلامه|编号|钢筋编号|筋号)$/],
    ['member', /^(member|element|location|structuralmember|العنصر|عنصر|构件|构件名称|部位)$/],
    ['diameter', /^(bar)?(dia|diam|diameter|size|barsize|ø|φ|⌀)$|^(القطر|قطر|قطرالسيخ|直径|钢筋直径|规格)$/],
    ['grade', /^(steel)?(grade|gr|class)$|^(الدرجه|درجه|درجهالحديد|牌号|等级|钢筋等级|钢筋牌号)$/],
    ['shape', /^(bending)?(shape|shapecode|shapeno|sc|bscode|code)$|^(الشكل|شكل|كودالشكل|رمزالشكل|شكلالثني|形状|形状代码|弯曲形状|形状编号)$/],
    ['length', /^(cut|cutting|bar)?(length|len|l)$|^(lengthofeachbar|lengtheach|eachlength|الطول|طول|طولالقص|طولالسيخ|长度|下料长度|单根长度|下料长)$/]
  ];
  var FIELD_NAMES = ['mark', 'member', 'diameter', 'grade', 'shape', 'length', 'qty', 'nMembers', 'nEach', 'totalLength', 'weight'];

  function matchField(h) {
    var n = norm(h);
    if (!n) return null;
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i][1].test(n)) return FIELDS[i][0];
    return null;
  }

  // Unit written in the header itself: "Length (mm)", "الطول (م)", "长度(米)".
  function headerUnit(h) {
    var s = String(h == null ? '' : h).toLowerCase();
    if (/\bmm\b|millimet|ملم|مم|毫米/.test(s)) return 'mm';
    if (/\(\s*m\s*\)|\[\s*m\s*\]|\bmetres?\b|\bmeters?\b|\(م\)|بالمتر|متر|（米）|\(米\)|米/.test(s)) return 'm';
    if (/\bkg\b|كجم|كغ|公斤|千克/.test(s)) return 'kg';
    if (/\b(t|tonnes?|tons?)\b|طن|吨/.test(s)) return 't';
    return null;
  }

  /* Scan the first rows for the header. Returns { headerRow, mapping, units,
     duplicates } or null when nothing usable is found. mapping is field ->
     column index. */
  function detectHeader(rows) {
    var best = null;
    for (var r = 0; r < Math.min(rows.length, LIMITS.headerScan); r++) {
      var row = rows[r] || [];
      var mapping = {}, dup = [];
      for (var c = 0; c < row.length; c++) {
        var f = matchField(row[c]);
        if (!f) continue;
        if (mapping[f] == null) mapping[f] = c; else dup.push(f);
      }
      var hasQty = mapping.qty != null || (mapping.nMembers != null && mapping.nEach != null);
      var score = Object.keys(mapping).length + (mapping.diameter != null ? 2 : 0) + (mapping.length != null ? 2 : 0) + (hasQty ? 2 : 0);
      if (mapping.diameter == null || mapping.length == null || !hasQty) continue;
      if (!best || score > best.score) best = { headerRow: r, mapping: mapping, duplicates: dup, score: score };
    }
    if (!best) return null;
    var hdr = rows[best.headerRow];
    return {
      headerRow: best.headerRow,
      mapping: best.mapping,
      duplicates: best.duplicates,
      units: {
        length: best.mapping.length != null ? lenUnit(headerUnit(hdr[best.mapping.length])) : null,
        totalLength: best.mapping.totalLength != null ? lenUnit(headerUnit(hdr[best.mapping.totalLength])) : null,
        weight: best.mapping.weight != null ? massUnit(headerUnit(hdr[best.mapping.weight])) : null
      }
    };
  }
  function lenUnit(u) { return u === 'mm' || u === 'm' ? u : null; }
  function massUnit(u) { return u === 'kg' || u === 't' ? u : null; }

  /* ---- cell readers ------------------------------------------------------ */
  function isBlank(v) { return v == null || (typeof v === 'string' && v.trim() === ''); }
  function text(v) { return isBlank(v) ? '' : String(v).trim().slice(0, LIMITS.text); }

  /* Plain decimal numbers only. A comma is refused rather than guessed:
     "2,350" is 2.35 in some countries and 2350 in others. */
  function readNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? { ok: true, n: v } : { ok: false, why: 'number' };
    if (typeof v === 'boolean') return { ok: false, why: 'number' };   // TRUE/FALSE is a value, just not a number
    if (isBlank(v)) return { ok: false, why: 'missing' };
    var s = String(v).trim().replace(/ /g, '');
    if (/,/.test(s)) return { ok: false, why: 'comma' };
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return { ok: false, why: 'number' };
    return { ok: true, n: Number(s) };
  }

  /* Diameter as written on drawings: 16, "16", "T16", "Y16", "H16", "Ø16",
     "16mm". "#5" is a US bar size number, not millimetres: refused. */
  function readDiameter(v) {
    if (typeof v === 'number') return checkDia(v);
    if (isBlank(v)) return { ok: false, why: 'missing' };
    var s = String(v).trim().replace(/\s+/g, '');
    if (/^#/.test(s)) return { ok: false, why: 'imperial' };
    var m = /^(?:[TYHRBDN]|Ø|ø|φ|Φ|⌀)?(\d+(?:\.\d+)?)(?:mm|ملم|مم|毫米)?$/i.exec(s);
    if (!m) return { ok: false, why: 'number' };
    return checkDia(Number(m[1]));
  }
  function checkDia(d) {
    if (!isFinite(d) || d < LIMITS.dMin || d > LIMITS.dMax) return { ok: false, why: 'range' };
    return { ok: true, n: d, standard: STANDARD_DIAS.indexOf(d) >= 0 };
  }

  /* Grades are compared after removing spaces and case; the common ways of
     writing ASTM A615 Grade 60/80 are folded together. Anything else is kept
     as written (upper case), never mapped to something it might mean. */
  function normGrade(v) {
    var raw = text(v);
    if (!raw) return { key: '', label: '', raw: '' };
    var k = raw.toUpperCase().replace(/[\s._\-]+/g, '');
    var m = /^(?:ASTM)?(?:A615M?)?(?:GRADE|GR|G)?(40|60|75|80|100)$/.exec(k);
    if (m) return { key: 'GR' + m[1], label: 'Gr' + m[1], raw: raw };
    return { key: k, label: raw.toUpperCase().replace(/\s+/g, ' '), raw: raw };
  }

  function readCount(v) {
    var r = readNumber(v);
    if (!r.ok) return r;
    if (Math.floor(r.n) !== r.n) return { ok: false, why: 'fraction' };
    if (r.n < 1) return { ok: false, why: 'range' };
    if (r.n > LIMITS.qtyMax) return { ok: false, why: 'range' };
    return r;
  }

  function round3(x) { return Math.round(x * 1000) / 1000; }

  /* ---- analysis ---------------------------------------------------------- */
  /* opts: { headerRow, mapping, units: { length, totalLength, weight },
             formulaCells (Set of "r,c"), errorCells (Set),
             assignGrade: grade the user chose for rows that have none }
     Returns { ok, error?, rows: valid rows, issues, warnings, summary } */
  function analyze(grid, opts) {
    opts = opts || {};
    var map = opts.mapping || {};
    var units = opts.units || {};
    var hr = opts.headerRow == null ? -1 : opts.headerRow;
    var fc = opts.formulaCells || new Set(), ec = opts.errorCells || new Set();

    // configuration errors stop the analysis before any row is read
    var missing = [];
    if (map.diameter == null) missing.push('diameter');
    if (map.length == null) missing.push('length');
    if (map.qty == null && (map.nMembers == null || map.nEach == null)) missing.push('qty');
    if (missing.length) return { ok: false, error: 'missingColumns', missing: missing };
    if (units.length !== 'mm' && units.length !== 'm') return { ok: false, error: 'lengthUnit' };
    var used = {};
    for (var f in map) if (map[f] != null) {
      if (used[map[f]] != null) return { ok: false, error: 'sameColumn', fields: [used[map[f]], f] };
      used[map[f]] = f;
    }

    var rows = [], issues = [], blank = 0, formulaRows = 0;
    var dataRows = grid.length - (hr + 1);
    if (dataRows > LIMITS.rows) return { ok: false, error: 'tooManyRows' };

    for (var r = hr + 1; r < grid.length; r++) {
      var cells = grid[r] || [];
      var get = function (field) { return map[field] == null ? null : cells[map[field]]; };
      if (cells.every(isBlank)) { blank++; continue; }
      var rowNo = r + 1;                                   // as the spreadsheet numbers it
      var errs = [], warns = [];
      var touched = Object.keys(map).filter(function (k) { return map[k] != null; });
      if (touched.some(function (k) { return ec.has(r + ',' + map[k]); })) errs.push('cellError');
      var fromFormula = touched.some(function (k) { return fc.has(r + ',' + map[k]); });

      var dv = readDiameter(get('diameter'));
      var lv = readNumber(get('length'));
      var mark = text(get('mark')), member = text(get('member')), shape = text(get('shape'));
      var grade = normGrade(get('grade'));

      // a row with neither diameter nor length is a note, title or subtotal
      if (isBlank(get('diameter')) && isBlank(get('length'))) {
        issues.push({ row: rowNo, codes: ['unreadable'], mark: mark, raw: rawOf(cells) });
        continue;
      }

      if (!dv.ok) errs.push(dv.why === 'imperial' ? 'diaImperial' : dv.why === 'missing' ? 'diaMissing' : 'diaInvalid');
      var lengthMm = null;
      if (!lv.ok) errs.push(lv.why === 'missing' ? 'lenMissing' : lv.why === 'comma' ? 'lenComma' : 'lenInvalid');
      else if (lv.n <= 0) errs.push('lenNotPositive');
      else {
        lengthMm = round3(units.length === 'm' ? lv.n * 1000 : lv.n);
        // values that only make sense in the other unit: refuse, do not convert
        if (units.length === 'm' && lv.n > 100) errs.push('unitLooksMm');
        else if (units.length === 'mm' && lv.n < 20) errs.push('unitLooksM');
        else if (lengthMm > STOCK_MM) errs.push('overStock');
      }

      var qty = null, qv = null, nm = null, ne = null;
      if (map.qty != null) {
        qv = readCount(get('qty'));
        if (!qv.ok) errs.push(qv.why === 'missing' ? 'qtyMissing' : qv.why === 'fraction' ? 'qtyFraction' : 'qtyInvalid');
        else qty = qv.n;
      }
      if (map.nMembers != null && map.nEach != null) {
        nm = readCount(get('nMembers')); ne = readCount(get('nEach'));
        if (map.qty == null) {
          if (!nm.ok || !ne.ok) errs.push('qtyFactors');
          else qty = nm.n * ne.n;
        } else if (qty != null && nm.ok && ne.ok && nm.n * ne.n !== qty) {
          errs.push('qtyMismatch');                         // the sheet contradicts itself
        }
      }
      if (qty != null && qty > LIMITS.qtyMax) errs.push('qtyInvalid');

      if (errs.length) {
        issues.push({
          row: rowNo, codes: errs, mark: mark, member: member, raw: rawOf(cells),
          // the values as read, for the excluded-rows table; null when unreadable
          diameter: dv.ok ? dv.n : null, lengthMm: lengthMm, qty: qty,
          diameterText: text(get('diameter')), lengthText: text(get('length')), qtyText: map.qty != null ? text(get('qty')) : ''
        });
        continue;
      }

      if (!dv.standard) warns.push('diaNonStandard');
      if (fromFormula) { warns.push('formula'); formulaRows++; }
      // a grade the user assigned explicitly to rows that have none
      var assigned = false;
      if (!grade.key && opts.assignGrade) {
        var ag = normGrade(opts.assignGrade);
        if (ag.key) { grade = { key: ag.key, label: ag.label, raw: '' }; assigned = true; warns.push('gradeAssigned'); }
      }
      if (map.grade != null && !grade.key) warns.push('gradeMissing');   // per row only when the sheet has a grade column

      var uw = unitWeight(dv.n);
      var totLenM = lengthMm * qty / 1000;
      var wt = uw * totLenM;

      // cross-checks against totals typed in the sheet, only when their unit is known
      if (map.weight != null && !isBlank(get('weight'))) {
        var wv = readNumber(get('weight'));
        if (wv.ok && units.weight) {
          var sheetKg = units.weight === 't' ? wv.n * 1000 : wv.n;
          if (Math.abs(sheetKg - wt) > Math.max(0.5, wt * 0.01)) warns.push('weightDiff');
        }
      }
      if (map.totalLength != null && !isBlank(get('totalLength'))) {
        var tv = readNumber(get('totalLength'));
        if (tv.ok && units.totalLength) {
          var sheetM = units.totalLength === 'mm' ? tv.n / 1000 : tv.n;
          if (Math.abs(sheetM - totLenM) > Math.max(0.01, totLenM * 0.005)) warns.push('totalLengthDiff');
        }
      }

      rows.push({
        row: rowNo, mark: mark, member: member, diameter: dv.n, grade: grade.label, gradeKey: grade.key, gradeRaw: grade.raw,
        shape: shape, lengthMm: lengthMm, qty: qty, unitWeight: uw, totalLengthM: totLenM, weightKg: wt, warnings: warns, gradeAssigned: assigned
      });
    }

    var warnings = [];
    // Repeated bar marks. With a member column, a mark is compared only with
    // the same mark in the same member: the same mark in another member is
    // normal. Without one, uniqueness cannot be established, which is said
    // plainly. Repeats are flagged for review; every row and quantity stays.
    var hasMember = map.member != null;
    var seen = {};
    rows.forEach(function (x) {
      if (!x.mark) return;
      var k = (hasMember ? x.member.toUpperCase() + '|' : '') + x.mark.toUpperCase();
      (seen[k] = seen[k] || []).push(x);
    });
    Object.keys(seen).forEach(function (k) {
      var g = seen[k];
      if (g.length < 2) return;
      var sig = function (x) { return [x.diameter, x.gradeKey, x.shape.toUpperCase(), x.lengthMm].join('|'); };
      var conflict = g.some(function (x) { return sig(x) !== sig(g[0]); });
      var code = conflict ? 'dupMarkConflict' : 'dupMark';
      g.forEach(function (x) { if (x.warnings.indexOf(code) < 0) x.warnings.push(code); });
      warnings.push({ code: code, mark: g[0].mark, member: hasMember ? g[0].member : null, scoped: hasMember, rows: g.map(function (x) { return x.row; }) });
    });
    if (map.mark != null && !hasMember && rows.some(function (x) { return x.mark; })) warnings.push({ code: 'dupNoMember' });
    // grade consistency
    var gradeKeys = {}, spellings = {};
    rows.forEach(function (x) {
      if (!x.gradeKey) return;
      gradeKeys[x.gradeKey] = true;
      if (!x.gradeAssigned) (spellings[x.gradeKey] = spellings[x.gradeKey] || {})[x.gradeRaw] = true;
    });
    var nGrades = Object.keys(gradeKeys).length;
    var noGrade = rows.filter(function (x) { return !x.gradeKey; }).length;
    if (nGrades > 1) warnings.push({ code: 'multiGrade', grades: Object.keys(gradeKeys).map(function (k) { return rows.filter(function (x) { return x.gradeKey === k; })[0].grade; }) });
    if (noGrade && nGrades) warnings.push({ code: 'gradePartlyMissing', count: noGrade });
    else if (noGrade && rows.length) warnings.push({ code: 'gradeAllMissing' });
    Object.keys(spellings).forEach(function (k) {
      var s = Object.keys(spellings[k]);
      if (s.length > 1) warnings.push({ code: 'gradeSpellings', spellings: s });
    });
    var nonStd = uniq(rows.filter(function (x) { return x.warnings.indexOf('diaNonStandard') >= 0; }).map(function (x) { return x.diameter; }));
    if (nonStd.length) warnings.push({ code: 'diaNonStandard', diameters: nonStd });
    var assignedRows = rows.filter(function (x) { return x.gradeAssigned; });
    if (assignedRows.length) warnings.push({ code: 'gradeAssigned', count: assignedRows.length, grade: assignedRows[0].grade });
    if (formulaRows) warnings.push({ code: 'formula', count: formulaRows });
    var wd = rows.filter(function (x) { return x.warnings.indexOf('weightDiff') >= 0; }).length;
    if (wd) warnings.push({ code: 'weightDiff', count: wd });
    if (map.weight != null && !units.weight) warnings.push({ code: 'weightUnitUnknown' });
    var tld = rows.filter(function (x) { return x.warnings.indexOf('totalLengthDiff') >= 0; }).length;
    if (tld) warnings.push({ code: 'totalLengthDiff', count: tld });
    if (map.qty == null) warnings.push({ code: 'qtyFromFactors' });

    // Over-length rows: counted apart, never in the totals above.
    var over = { rows: 0, bars: 0, lengthM: 0, weightKg: 0, rowsWithoutQty: 0 };
    issues.forEach(function (x) {
      if (x.codes.indexOf('overStock') < 0) return;
      over.rows++;
      if (x.diameter != null && x.qty != null) {
        over.bars += x.qty;
        over.lengthM += x.lengthMm * x.qty / 1000;
        over.weightKg += unitWeight(x.diameter) * x.lengthMm * x.qty / 1000;
      } else over.rowsWithoutQty++;
    });
    var noGrade = rows.filter(function (x) { return !x.gradeKey; });
    return {
      ok: true, rows: rows, issues: issues, warnings: warnings, blankRows: blank, summary: summarise(rows),
      excluded: { rows: issues.length, overStock: over },
      notForOptimizer: { rows: noGrade.length, bars: noGrade.reduce(function (a, x) { return a + x.qty; }, 0) }
    };
  }

  function rawOf(cells) {
    return cells.slice(0, 14).map(function (v) { return isBlank(v) ? '' : String(v).slice(0, 30); });
  }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }).sort(function (x, y) { return x - y; }); }

  function summarise(rows) {
    var t = { bars: 0, lengthM: 0, weightKg: 0, rows: rows.length };
    var byDia = {}, byGrade = {}, byShape = {}, byDiaGrade = {};
    function add(map, key, label, x) {
      var e = map[key] || (map[key] = { key: key, label: label, bars: 0, lengthM: 0, weightKg: 0, rows: 0 });
      e.bars += x.qty; e.lengthM += x.totalLengthM; e.weightKg += x.weightKg; e.rows++;
      return e;
    }
    rows.forEach(function (x) {
      t.bars += x.qty; t.lengthM += x.totalLengthM; t.weightKg += x.weightKg;
      add(byDia, String(x.diameter), x.diameter, x).unitWeight = x.unitWeight;
      add(byGrade, x.gradeKey, x.grade, x);
      add(byShape, x.shape.toUpperCase(), x.shape, x);
      var e = add(byDiaGrade, x.diameter + '|' + x.gradeKey, x.diameter, x);
      e.diameter = x.diameter; e.grade = x.grade; e.gradeKey = x.gradeKey;
    });
    function list(m, sorter) { return Object.keys(m).map(function (k) { return m[k]; }).sort(sorter); }
    return {
      totals: t,
      byDiameter: list(byDia, function (a, b) { return a.label - b.label; }),
      byGrade: list(byGrade, function (a, b) { return b.weightKg - a.weightKg; }),
      byShape: list(byShape, function (a, b) { return b.weightKg - a.weightKg; }),
      byDiameterGrade: list(byDiaGrade, function (a, b) { return a.diameter - b.diameter || (a.gradeKey < b.gradeKey ? -1 : 1); })
    };
  }

  /* ---- hand-off to the cutting optimizer --------------------------------- */
  /* Groups valid rows by diameter, grade and cut length (whole millimetres)
     and adds up the bars. Different diameters or grades are never merged.
     Rows without a grade are held back until the user assigns one (it is
     never assumed). Lengths are rounded to the millimetre the optimizer works
     in, and the number of rows that moved is reported. */
  function buildTransfer(rows) {
    var groups = {}, order = [], rounded = 0, tooLong = [], noGrade = { rows: [], bars: 0 };
    rows.forEach(function (x) {
      // defensive: analyze() already excludes these, but nothing over the
      // stock length and nothing without a grade may ever leave this function
      if (!(x.lengthMm <= STOCK_MM)) { tooLong.push(x.row); return; }
      if (!x.gradeKey) { noGrade.rows.push(x.row); noGrade.bars += x.qty; return; }
      var mm = Math.round(x.lengthMm);
      if (Math.abs(mm - x.lengthMm) > 1e-9) rounded++;
      if (mm > STOCK_MM) { tooLong.push(x.row); return; }
      var k = x.diameter + '|' + x.gradeKey + '|' + mm;
      if (!groups[k]) { groups[k] = [x.diameter, x.grade.slice(0, 20), mm, 0]; order.push(k); }
      groups[k][3] += x.qty;
    });
    var items = order.map(function (k) { return groups[k]; });
    items.sort(function (a, b) { return a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || b[2] - a[2]; });
    return { items: items, rounded: rounded, tooLong: tooLong, noGrade: noGrade };
  }

  // URL-fragment payload: never sent to the server, never stored. base64url
  // of UTF-8 JSON, with a version number so a future format can be told apart.
  function encodeTransfer(items) {
    var json = JSON.stringify({ v: 1, items: items });
    var b64;
    if (typeof Buffer !== 'undefined' && typeof window === 'undefined') b64 = Buffer.from(json, 'utf8').toString('base64');
    else {
      var bytes = new TextEncoder().encode(json), bin = '';
      for (var i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      b64 = btoa(bin);
    }
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /* ---- CSV export, safe to open in Excel --------------------------------- */
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r|]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(table) { return '﻿' + table.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'); }

  return {
    parseDelimited: parseDelimited, detectDelimiter: detectDelimiter, detectHeader: detectHeader, matchField: matchField,
    headerUnit: headerUnit, analyze: analyze, buildTransfer: buildTransfer, encodeTransfer: encodeTransfer,
    unitWeight: unitWeight, normGrade: normGrade, readDiameter: readDiameter, readNumber: readNumber,
    csvCell: csvCell, toCsv: toCsv, FIELD_NAMES: FIELD_NAMES, STANDARD_DIAS: STANDARD_DIAS, LIMITS: LIMITS, STOCK_MM: STOCK_MM
  };
});
