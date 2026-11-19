/* ==========================================================================
   mashharawi.com, BBS Analyzer: the page
   --------------------------------------------------------------------------
   UI only. Reading files: xlsx.js (BbsXlsx) and engine.parseDelimited.
   Every calculation: engine.js (BbsEngine). Text: i18n.js (BbsText).

   Privacy: the file is read with FileReader into memory in this tab. There
   is no fetch, no upload, no storage API. Cell contents are written to the
   page with textContent only. "Send to Cutting Optimizer" opens the
   optimizer in a new tab with the grouped lines in the URL fragment (#...),
   which browsers never send to the server, and the optimizer removes it from
   the address bar as soon as it has read it. The original schedule stays in
   this tab, unchanged.

   No accounts: everything works without signing in. State lives in the
   `state` object below, so a future account feature could save and load it
   without touching the engine.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('bbs');
  if (!root || !window.BbsEngine || !window.BbsText) return;
  var E = window.BbsEngine;

  var LANG = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
  var L = LANG.indexOf('ar') === 0 ? 'ar' : (LANG.indexOf('zh') === 0 ? 'zh' : 'en');
  var T = window.BbsText[L];
  var OPT_URL = { en: '/tools/cutting-optimizer/', ar: '/ar/tools/cutting-optimizer/', zh: '/zh/rebar-cutting-optimizer/' }[L];
  var MAX_TRANSFER = 2000;
  var ROW_PAGE = 300;

  var state = { grid: null, source: '', formulaCells: new Set(), errorCells: new Set(), headerRow: -1, mapping: {}, units: {}, unitHow: null, assignGrade: '', result: null };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function fmt(n, dp) { return isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '0'; }
  function say(text, kind) { var m = $('bMsg'); m.textContent = text || ''; m.className = 'co-msg' + (kind ? ' ' + kind : ''); }
  function cellText(v) { return v == null ? '' : String(v); }
  // the exact millimetre value as decided, with thousands separators and no rounding
  function exactMm(t) { var p = String(t).split('.'); return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (p[1] ? '.' + p[1] : ''); }

  /* ---- loading data ------------------------------------------------------ */
  function loadGrid(grid, source, extra) {
    extra = extra || {};
    grid = grid || [];
    if (!grid.length || grid.every(function (r) { return !r || r.every(function (v) { return v == null || String(v).trim() === ''; }); })) {
      say(T.msg.empty, 'warn'); return;
    }
    state.grid = grid;
    state.source = source;
    state.formulaCells = extra.formulaCells || new Set();
    state.errorCells = extra.errorCells || new Set();
    state.result = null;
    state.assignGrade = '';                 // a grade assigned to one schedule never carries over
    $('bOut').hidden = true;

    var det = E.detectHeader(grid);
    if (det) {
      state.headerRow = det.headerRow;
      state.mapping = det.mapping;
      state.units = { length: det.units.length || '', totalLength: det.units.totalLength || '', weight: det.units.weight || '' };
      state.unitHow = det.units.length ? 'header' : null;
    } else {
      state.headerRow = 0; state.mapping = {}; state.units = { length: '', totalLength: '', weight: '' }; state.unitHow = null;
    }
    var nRows = grid.length;
    var lines = [T.msg.loaded(nRows, source), det ? T.msg.detected(det.headerRow + 1) : T.msg.noHeader];
    if (extra.truncated) lines.push(T.msg.sheetTruncated);
    state.loadMsg = { text: lines.join(' '), kind: det ? '' : 'warn' };
    say(state.loadMsg.text, state.loadMsg.kind);
    renderMapping();
    if (det && state.units.length) analyse();
  }

  $('bFile').addEventListener('change', function () { if (this.files[0]) readFile(this.files[0]); this.value = ''; });
  var drop = $('bDrop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) readFile(f); });

  function readFile(file) {
    var name = file.name || 'file';
    var lower = name.toLowerCase();
    $('bSheetWrap').hidden = true;
    if (/\.xls$/.test(lower)) { say(T.msg.xlsx.xls, 'warn'); return; }
    if (file.size > window.BbsXlsx.LIMITS.fileBytes) { say(T.msg.xlsx.tooLarge, 'warn'); return; }
    say(T.msg.reading);
    var fr = new FileReader();
    if (/\.(xlsx|xlsm)$/.test(lower)) {
      fr.onload = function () {
        window.BbsXlsx.open(fr.result).then(function (wb) {
          var sel = $('bSheet');
          sel.textContent = '';
          wb.sheets.forEach(function (n, i) { var o = el('option', null, n); o.value = i; sel.appendChild(o); });
          $('bSheetWrap').hidden = wb.sheets.length < 2;
          sel.onchange = function () { openSheet(wb, +sel.value, name); };
          openSheet(wb, 0, name);
        }).catch(xlsxFail);
      };
      fr.readAsArrayBuffer(file);
    } else {
      fr.onload = function () { loadGrid(E.parseDelimited(fr.result), name); };
      fr.readAsText(file);
    }
  }
  function openSheet(wb, i, name) {
    say(T.msg.reading);
    wb.readSheet(i).then(function (s) {
      loadGrid(s.rows, name + ' · ' + wb.sheets[i], { formulaCells: s.formulaCells, errorCells: s.errorCells, truncated: s.truncated });
    }).catch(xlsxFail);
  }
  function xlsxFail(e) { say(T.msg.xlsx[e && e.code] || T.msg.xlsx.other, 'warn'); }

  $('bPasteGo').addEventListener('click', function () {
    var t = $('bPaste').value;
    loadGrid(E.parseDelimited(t, t.indexOf('\t') >= 0 ? '\t' : undefined), T.msg.pasted);
  });
  $('bSample').addEventListener('click', function () { loadGrid(JSON.parse(JSON.stringify(T.sample)), T.msg.sample); });

  /* manual entry: a small grid with fixed columns, analysed like any sheet */
  var MAN_COLS = ['member', 'mark', 'diameter', 'grade', 'shape', 'length', 'qty'];
  function manRow(v) {
    v = v || {};
    var tr = document.createElement('tr');
    MAN_COLS.forEach(function (f) {
      var td = el('td'), inp = el('input', 'co-in b-' + f);
      inp.type = (f === 'diameter' || f === 'length' || f === 'qty') ? 'number' : 'text';
      if (inp.type === 'number') { inp.inputMode = f === 'length' ? 'decimal' : 'numeric'; inp.step = f === 'length' ? 'any' : '1'; inp.min = '0'; }
      else inp.maxLength = 30;
      if (f === 'diameter') inp.setAttribute('list', 'bDiaList');
      if (f === 'grade') inp.setAttribute('list', 'bGradeList');
      inp.setAttribute('aria-label', f === 'length' ? T.fields.length + ' (mm)' : T.fields[f]);
      inp.value = v[f] != null ? v[f] : '';
      td.appendChild(inp); tr.appendChild(td);
    });
    var td = el('td'), x = el('button', 'calc-x', '×');
    x.type = 'button'; x.setAttribute('aria-label', '×');
    x.addEventListener('click', function () { tr.remove(); });
    td.appendChild(x); tr.appendChild(td);
    $('bManRows').appendChild(tr);
  }
  $('bManAdd').addEventListener('click', function () { manRow({ grade: 'Gr60' }); });
  $('bManGo').addEventListener('click', function () {
    var head = ['Member', 'Bar mark', 'Diameter', 'Grade', 'Shape code', 'Cut length (mm)', 'Total No.'];
    var grid = [head];
    [].forEach.call($('bManRows').querySelectorAll('tr'), function (tr) {
      grid.push(MAN_COLS.map(function (f) { var v = tr.querySelector('.b-' + f).value; return v === '' ? null : v; }));
    });
    loadGrid(grid, T.msg.manual);
  });
  manRow({ grade: 'Gr60' });

  /* ---- column mapping ---------------------------------------------------- */
  var REQUIRED = { diameter: 1, length: 1 };
  function renderMapping() {
    $('bMap').hidden = false;
    var hdr = state.grid[state.headerRow] || [];
    var width = state.grid.reduce(function (w, r) { return Math.max(w, r ? r.length : 0); }, 0);
    $('bHdr').value = state.headerRow + 1;
    $('bHdr').max = Math.min(state.grid.length, 60);

    var box = $('bFields');
    box.textContent = '';
    E.FIELD_NAMES.forEach(function (f) {
      var lab = el('label', 'calc-field');
      var req = REQUIRED[f] || (f === 'qty' && !(state.mapping.nMembers != null && state.mapping.nEach != null));
      lab.appendChild(el('span', null, T.fields[f] + (req ? ' · ' + T.required : '')));
      var s = el('select', 'co-in');
      s.id = 'm_' + f;
      var o = el('option', null, T.msg && T.none); o.value = ''; s.appendChild(o);
      for (var c = 0; c < width; c++) {
        var h = cellText(hdr[c]).slice(0, 40);
        var opt = el('option', null, colName(c) + (h ? ' · ' + h : ''));
        opt.value = c;
        s.appendChild(opt);
      }
      s.value = state.mapping[f] != null ? String(state.mapping[f]) : '';
      s.addEventListener('change', function () {
        if (s.value === '') delete state.mapping[f]; else state.mapping[f] = +s.value;
        if (f === 'length' || f === 'totalLength' || f === 'weight') {
          var u = E.headerUnit(hdr[state.mapping[f]]);
          var ok = f === 'weight' ? (u === 'kg' || u === 't') : (u === 'mm' || u === 'm');
          state.units[f] = ok ? u : '';
          if (f === 'length') state.unitHow = ok ? 'header' : null;
          syncUnits();
        }
        renderPreview();
      });
      lab.appendChild(s);
      box.appendChild(lab);
    });
    syncUnits();
    renderPreview();
  }
  function colName(c) { var s = ''; c++; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }

  function syncUnits() {
    $('uLength').value = state.units.length || '';
    $('uTotalLength').value = state.units.totalLength || '';
    $('uWeight').value = state.units.weight || '';
    $('uLength').classList.toggle('need', !state.units.length);
  }
  $('uLength').addEventListener('change', function () { state.units.length = this.value; state.unitHow = this.value ? 'user' : null; syncUnits(); });
  $('uTotalLength').addEventListener('change', function () { state.units.totalLength = this.value; });
  $('uWeight').addEventListener('change', function () { state.units.weight = this.value; });
  $('bHdr').addEventListener('change', function () {
    var v = Math.max(1, Math.min(state.grid.length, parseInt(this.value, 10) || 1));
    state.headerRow = v - 1;
    // re-match names on the chosen row, keeping nothing from the old row
    var hdr = state.grid[state.headerRow] || [];
    state.mapping = {};
    hdr.forEach(function (h, c) { var f = E.matchField(h); if (f && state.mapping[f] == null) state.mapping[f] = c; });
    state.units = {
      length: state.mapping.length != null ? unitOr(E.headerUnit(hdr[state.mapping.length]), ['mm', 'm']) : '',
      totalLength: state.mapping.totalLength != null ? unitOr(E.headerUnit(hdr[state.mapping.totalLength]), ['mm', 'm']) : '',
      weight: state.mapping.weight != null ? unitOr(E.headerUnit(hdr[state.mapping.weight]), ['kg', 't']) : ''
    };
    state.unitHow = state.units.length ? 'header' : null;
    renderMapping();
  });
  function unitOr(u, allowed) { return allowed.indexOf(u) >= 0 ? u : ''; }

  function renderPreview() {
    var tb = $('bPreview');
    tb.textContent = '';
    var used = {};
    Object.keys(state.mapping).forEach(function (f) { used[state.mapping[f]] = f; });
    var width = state.grid.reduce(function (w, r) { return Math.max(w, r ? r.length : 0); }, 0);
    var from = state.headerRow, to = Math.min(state.grid.length, state.headerRow + 7);
    for (var r = from; r < to; r++) {
      var tr = el('tr', r === state.headerRow ? 'hdr' : '');
      tr.appendChild(el('th', 'num', String(r + 1)));
      for (var c = 0; c < Math.min(width, 16); c++) {
        var td = el(r === state.headerRow ? 'th' : 'td', used[c] ? 'used' : '', cellText((state.grid[r] || [])[c]).slice(0, 24));
        if (used[c] && r === state.headerRow) td.title = T.fields[used[c]];
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
  }

  $('bAnalyze').addEventListener('click', analyse);

  /* ---- analysis and results ---------------------------------------------- */
  function analyse() {
    var res = E.analyze(state.grid, {
      headerRow: state.headerRow, mapping: state.mapping,
      units: { length: state.units.length || null, totalLength: state.units.totalLength || null, weight: state.units.weight || null },
      formulaCells: state.formulaCells, errorCells: state.errorCells,
      assignGrade: state.assignGrade || null
    });
    if (!res.ok) {
      var c = T.msg.cfg;
      var text = res.error === 'missingColumns' ? c.missingColumns(res.missing.map(function (f) { return T.fields[f]; }))
        : res.error === 'sameColumn' ? c.sameColumn(T.fields[res.fields[0]], T.fields[res.fields[1]])
        : c[res.error];
      say(text, 'warn');
      $('bOut').hidden = true;
      if (res.error === 'lengthUnit') $('uLength').focus();
      return;
    }
    state.result = res;
    // keep the note about what was read; clear any earlier configuration error
    if (state.loadMsg) say(state.loadMsg.text, state.loadMsg.kind); else say('');
    renderResult(res);
    $('bOut').hidden = false;
  }

  function renderResult(res) {
    var t = res.summary.totals;
    $('fBars').textContent = fmt(t.bars, 0);
    $('fWt').textContent = fmt(t.weightKg / 1000, 3);
    $('fLen').textContent = fmt(t.lengthM, 2);
    $('fRows').textContent = T.rowsUsed(res.rows.length, res.issues.length, res.blankRows);
    $('bSrc').textContent = state.source + ' · ' + new Date().toISOString().slice(0, 10);

    // warnings and assumptions
    var wl = $('bWarn'); wl.textContent = '';
    res.warnings.forEach(function (w) {
      var f = T.warn[w.code];
      var li = el('li', /Conflict|weightDiff|overStock|formula/.test(w.code) ? 'hot' : '', typeof f === 'function' ? f(w) : f);
      wl.appendChild(li);
    });
    $('bWarnBox').hidden = !res.warnings.length;
    var al = $('bAssume'); al.textContent = '';
    al.appendChild(el('li', null, T.lenUnitFrom(T[state.units.length], state.unitHow === 'header' ? 'header' : 'user')));
    T.assume.forEach(function (a) { al.appendChild(el('li', null, a)); });

    // breakdowns
    var max = res.summary.byDiameter.reduce(function (m, x) { return Math.max(m, x.weightKg); }, 0);
    table('tDia', [T.th.dia, T.th.kgm, T.th.bars, T.th.len, T.th.kg, T.th.share], res.summary.byDiameter.map(function (x) {
      return [String(x.label), fmt(x.unitWeight, 3), fmt(x.bars, 0), fmt(x.lengthM, 2), fmt(x.weightKg, 1), { bar: max ? x.weightKg / max : 0, text: fmt(t.weightKg ? x.weightKg / t.weightKg * 100 : 0, 1) + '%' }];
    }), [ '', '', fmt(t.bars, 0), fmt(t.lengthM, 2), fmt(t.weightKg, 1), '100%' ]);
    table('tDiaGrade', [T.th.dia, T.th.grade, T.th.bars, T.th.len, T.th.kg], res.summary.byDiameterGrade.map(function (x) {
      return [String(x.diameter), x.grade || T.noGrade, fmt(x.bars, 0), fmt(x.lengthM, 2), fmt(x.weightKg, 1)];
    }));
    table('tGrade', [T.th.grade, T.th.bars, T.th.kg, T.th.share], res.summary.byGrade.map(function (x) {
      return [x.label || T.noGrade, fmt(x.bars, 0), fmt(x.weightKg, 1), fmt(t.weightKg ? x.weightKg / t.weightKg * 100 : 0, 1) + '%'];
    }));
    table('tShape', [T.th.shape, T.th.bars, T.th.kg, T.th.share], res.summary.byShape.map(function (x) {
      return [x.label || T.noShape, fmt(x.bars, 0), fmt(x.weightKg, 1), fmt(t.weightKg ? x.weightKg / t.weightKg * 100 : 0, 1) + '%'];
    }));
    table('tIssues', [T.th.row, T.th.mark, T.th.dia, T.th2.cut, T.th2.qty, T.th.problem], res.issues.map(function (x) {
      return [String(x.row), x.mark, x.diameter != null ? String(x.diameter) : x.diameterText,
        x.lengthExact != null ? exactMm(x.lengthExact) + ' mm' : x.lengthText,
        x.qty != null ? fmt(x.qty, 0) : x.qtyText,
        x.codes.map(function (c) { return T.issue[c] || c; }).join(' · ')];
    }));
    $('bIssuesBox').hidden = !res.issues.length;
    renderRows(res.rows, ROW_PAGE);
    renderGroups(res);

    var tr = E.buildTransfer(res.rows);
    $('bSendNote').textContent = T.sendNote(tr.items.length, tr.rounded, tr.noGrade.rows.length, fmt(tr.noGrade.bars, 0));
    $('bSend').disabled = !tr.items.length;
  }

  /* The three groups every row falls into, so it is always clear why a row
     is or is not counted, and why it may not reach the optimizer. */
  function renderGroups(res) {
    var box = $('bGroups'), t = res.summary.totals;
    box.textContent = '';
    function card(cls, title, lines) {
      var c = el('section', 'b-group ' + cls);
      c.appendChild(el('h3', null, title));
      lines.forEach(function (l) { if (l) c.appendChild(typeof l === 'string' ? el('p', null, l) : l); });
      box.appendChild(c);
      return c;
    }
    card('in', T.groups.included, [T.groups.includedText(fmt(res.rows.length, 0), fmt(t.bars, 0), fmt(t.weightKg / 1000, 3))]);
    var o = res.excluded.overStock;
    card('out', T.groups.excluded, res.excluded.rows ? [
      T.groups.excludedText(fmt(res.excluded.rows, 0)),
      o.rows ? T.groups.overText(fmt(o.rows, 0), fmt(o.bars, 0), fmt(o.lengthM, 2), fmt(o.weightKg / 1000, 3), o.rowsWithoutQty) : null
    ] : [T.groups.none]);
    var n = res.notForOptimizer;
    var assigned = res.rows.filter(function (x) { return x.gradeAssigned; }).length;
    var c3 = card('noopt', T.groups.noOpt, n.rows ? [T.groups.noOptText(fmt(n.rows, 0), fmt(n.bars, 0))] : [assigned ? T.warn.gradeAssigned({ count: assigned, grade: res.rows.filter(function (x) { return x.gradeAssigned; })[0].grade }) : T.groups.none]);
    if (n.rows || assigned) {
      /* One grade for ALL rows without a grade. The page says so, lists the
         rows, and the button stays disabled until the user ticks a
         confirmation. Nothing is assigned by default or by typing alone. */
      var missingRows = res.rows.filter(function (x) { return !x.gradeKey || x.gradeAssigned; });
      var list = missingRows.map(function (x) { return x.row; });
      var f = el('div', 'b-assign');
      var lab = el('label', 'calc-field');
      lab.appendChild(el('span', null, T.assign.label));
      var inp = el('input', 'co-in');
      inp.type = 'text'; inp.maxLength = 20; inp.id = 'bAssign';
      inp.setAttribute('list', 'bGradeList');
      inp.value = state.assignGrade || '';
      lab.appendChild(inp);
      f.appendChild(lab);
      c3.appendChild(el('p', 'b-scope', T.assign.scope(list.length, fmt(missingRows.reduce(function (a, x) { return a + x.qty; }, 0), 0), list.slice(0, 40).join(', ') + (list.length > 40 ? ' …' : ''))));
      var ok = el('label', 'b-confirm');
      var cb = el('input'); cb.type = 'checkbox'; cb.id = 'bAssignOk';
      ok.appendChild(cb);
      var okText = el('span', null, T.assign.confirm(list.length));
      ok.appendChild(okText);
      var go = el('button', 'calc-btn', T.assign.apply); go.type = 'button'; go.id = 'bAssignGo';
      function sync() {
        var v = inp.value.trim();
        go.disabled = !(cb.checked && v && E.normGrade(v).key);
        okText.textContent = T.assign.confirm(list.length, v ? E.normGrade(v).label : '');
      }
      inp.addEventListener('input', function () { cb.checked = false; sync(); });   // a new grade needs a new confirmation
      cb.addEventListener('change', sync);
      go.addEventListener('click', function () {
        var v = inp.value.trim();
        if (!cb.checked) { say(T.assign.needConfirm, 'warn'); return; }
        if (!v || !E.normGrade(v).key) { say(T.assign.empty, 'warn'); inp.focus(); return; }
        state.assignGrade = v; analyse();
      });
      f.appendChild(go);
      if (assigned) {
        var clr = el('button', 'calc-btn ghost', T.assign.clear); clr.type = 'button';
        clr.addEventListener('click', function () { state.assignGrade = ''; analyse(); });
        f.appendChild(clr);
      }
      c3.appendChild(f);
      c3.appendChild(ok);
      c3.appendChild(el('p', 'calc-hint', T.assign.help));
      sync();
    }
  }

  function table(id, head, rows, foot) {
    var tbl = $(id);
    tbl.textContent = '';
    var th = el('thead'), tr = el('tr');
    head.forEach(function (h, i) { tr.appendChild(el('th', i ? 'num' : '', h)); });
    th.appendChild(tr); tbl.appendChild(th);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var row = el('tr');
      r.forEach(function (v, i) {
        var td = el('td', i ? 'num' : '');
        if (v && typeof v === 'object') {
          var wrap = el('span', 'b-share');
          var trk = el('span', 'trk'), bar = el('i'); bar.style.inlineSize = (v.bar * 100).toFixed(1) + '%';
          trk.setAttribute('aria-hidden', 'true');
          trk.appendChild(bar); wrap.appendChild(trk); wrap.appendChild(el('b', null, v.text));
          td.appendChild(wrap);
        } else td.textContent = v;
        row.appendChild(td);
      });
      tb.appendChild(row);
    });
    tbl.appendChild(tb);
    if (foot) {
      var tf = el('tfoot'), fr = el('tr');
      foot.forEach(function (v, i) { fr.appendChild(el('td', i ? 'num' : '', v)); });
      tf.appendChild(fr); tbl.appendChild(tf);
    }
  }

  function renderRows(rows, limit) {
    var body = rows.slice(0, limit).map(function (x) {
      return [String(x.row), x.member, x.mark, String(x.diameter), x.grade || T.noGrade, x.shape || T.noShape, fmt(x.lengthMm, x.lengthMm % 1 ? 1 : 0),
        fmt(x.qty, 0), fmt(x.totalLengthM, 2), fmt(x.weightKg, 2), x.warnings.map(function (w) { return T.warnCodes[w] || w; }).join(' · ')];
    });
    table('tRows', [T.th.row, T.th.member, T.th.mark, T.th.dia, T.th.grade, T.th.shape, T.th.cut, T.th.bars, T.th.len, T.th.kg, T.th.warn], body);
    var more = $('bMore');
    more.hidden = rows.length <= limit;
    more.textContent = T.showAll(rows.length);
  }
  $('bMore').addEventListener('click', function () { if (state.result) renderRows(state.result.rows, Infinity); });

  /* ---- exports ------------------------------------------------------------ */
  $('bCsv').addEventListener('click', function () {
    var res = state.result; if (!res) return;
    var tbl = [['Row', 'Member', 'Bar mark', 'Diameter mm', 'Grade', 'Shape code', 'Cut length mm', 'Bars', 'Unit weight kg/m', 'Total length m', 'Theoretical weight kg', 'Notes']];
    res.rows.forEach(function (x) {
      tbl.push([x.row, x.member, x.mark, x.diameter, x.grade, x.shape, x.lengthMm, x.qty, x.unitWeight.toFixed(4), x.totalLengthM.toFixed(3), x.weightKg.toFixed(3), x.warnings.join(' ')]);
    });
    tbl.push([]);
    tbl.push(['Summary by diameter', '', '', 'Diameter mm', '', '', '', 'Bars', '', 'Total length m', 'Theoretical weight kg']);
    res.summary.byDiameter.forEach(function (x) { tbl.push(['', '', '', x.label, '', '', '', x.bars, '', x.lengthM.toFixed(3), x.weightKg.toFixed(3)]); });
    tbl.push(['Total', '', '', '', '', '', '', res.summary.totals.bars, '', res.summary.totals.lengthM.toFixed(3), res.summary.totals.weightKg.toFixed(3)]);
    tbl.push([]);
    tbl.push(['Excluded rows (not in any total above)']);
    tbl.push(['Row', 'Member', 'Bar mark', 'Diameter mm', 'Cut length mm', 'Bars', 'Reason codes', 'Reason']);
    res.issues.forEach(function (x) {
      tbl.push([x.row, x.member || '', x.mark, x.diameter != null ? x.diameter : x.diameterText, x.lengthMm != null ? x.lengthMm : x.lengthText,
        x.qty != null ? x.qty : x.qtyText, x.codes.join(' '), x.codes.map(function (c) { return window.BbsText.en.issue[c] || c; }).join(' / ')]);
    });
    var ov = res.excluded.overStock;
    if (ov.rows) tbl.push(['Over 12 m (excluded)', '', '', '', '', ov.bars, '', 'rows ' + ov.rows + ', ' + ov.lengthM.toFixed(3) + ' m, ' + ov.weightKg.toFixed(3) + ' kg theoretical, not in totals']);
    if (res.notForOptimizer.rows) tbl.push(['No grade (in totals, not sent to optimizer)', '', '', '', '', res.notForOptimizer.bars, '', 'rows ' + res.notForOptimizer.rows]);
    tbl.push([]);
    tbl.push(['Note', 'Theoretical weights: 0.006165 x d^2 kg/m. Estimates, not certified quantities. Cut lengths above 12000 mm are excluded. mashharawi.com']);
    var blob = new Blob([E.toCsv(tbl)], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bbs-analysis-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
  $('bPrint').addEventListener('click', function () { if (state.result) { renderRows(state.result.rows, Infinity); } window.print(); });

  /* ---- hand-off to the cutting optimizer --------------------------------- */
  $('bSend').addEventListener('click', function () {
    var res = state.result; if (!res) return;
    var tr = E.buildTransfer(res.rows);
    if (!tr.items.length) { say(T.msg.nothingToSend, 'warn'); return; }
    if (tr.items.length > MAX_TRANSFER) { say(T.msg.tooBig, 'warn'); return; }
    var url = OPT_URL + '#bbs=' + E.encodeTransfer(tr.items);
    var w = window.open(url, '_blank');
    if (w) { try { w.opener = null; } catch (e) { /* ignore */ } }
    // the link is always offered too, in case a pop-up blocker stopped the tab
    var m = $('bSendMsg');
    m.textContent = '';
    m.appendChild(document.createTextNode(T.msg.sent + ' ' + (w === null ? T.msg.popup + ' ' : '')));
    var a = el('a', null, OPT_URL); a.href = url; a.target = '_blank'; a.rel = 'noopener';
    m.appendChild(a);
  });

  var dl = $('bDiaList');
  [10, 12, 14, 16, 18, 20, 25, 32].forEach(function (d) { var o = document.createElement('option'); o.value = d; dl.appendChild(o); });
})();
