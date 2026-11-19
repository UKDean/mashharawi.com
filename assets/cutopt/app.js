/* ==========================================================================
   mashharawi.com, rebar cutting optimizer: the page
   --------------------------------------------------------------------------
   UI only. All arithmetic is in engine.js (window.CutOpt), which the tests
   cover. One file serves /tools/cutting-optimizer/, the Arabic page under
   /ar/ and the Chinese page under /zh/; the language is read from <html>.

   Privacy: nothing is stored and nothing is sent. Pasted tables are parsed
   as plain text in this page. Everything the visitor typed is written back
   with textContent, never innerHTML. The WhatsApp button asks first, then
   copies the plan and opens the chat; the visitor decides whether to send.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('cutopt');
  if (!root || !window.CutOpt) return;

  var LANG = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
  var L = LANG.indexOf('ar') === 0 ? 'ar' : (LANG.indexOf('zh') === 0 ? 'zh' : 'en');
  var WA = 'https://wa.me/message/D6ABM7QFWVSPB1';
  var DIAS = [8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32];

  var T = {
    en: {
      dia: 'Ø mm', grade: 'Grade', len: 'Length m', qty: 'Pieces', remove: 'Remove line',
      empty: 'Add the cut lengths you need, or paste them from Excel.',
      run: 'Optimise cutting', running: 'Calculating…',
      optimal: 'Proven minimum number of bars',
      optimalNote: 'The plan uses as many bars as the lower bound, so no plan can use fewer. With one stock length that is also the least possible waste.',
      heuristic: 'Good plan, not proven minimum',
      heuristicNote: function (g) { return 'At most ' + g + ' bar' + (g === 1 ? '' : 's') + ' above the lower bound in total. The true minimum lies somewhere in between.'; },
      bars: 'Stock bars', util: 'Utilisation', waste: 'Waste', weight: 'Weight to buy',
      pcs: 'pcs', t: 't', m: 'm', kg: 'kg',
      sumHead: ['Ø mm', 'Grade', 'Pieces', 'Bars', 'Required m', 'Bought m', 'Waste m', 'Waste %', 'Reusable m', 'Weight t', 'Result'],
      provenShort: 'Proven', heurShort: function (g) { return '≤ +' + g; },
      patterns: 'Cutting patterns', times: '×', offcut: 'offcut', reusable: 'reusable', scrap: 'scrap', kerf: 'kerf',
      bar: 'bar', perBar: 'per bar',
      reuseHead: 'Reusable offcuts', none: 'None',
      showAll: function (n) { return 'Show all ' + n + ' patterns'; },
      csv: 'Download CSV', print: 'Print / PDF', send: 'Send this plan on WhatsApp',
      confirmSend: 'This copies the cutting summary and opens WhatsApp with Omar Mashharawi (Al Rajhi Steel sales). Nothing is sent until you paste and send it yourself. Continue?',
      copied: 'Summary copied. Paste it in the chat.',
      pasteOk: function (n, bad) { return n + ' line' + (n === 1 ? '' : 's') + ' imported' + (bad ? ', ' + bad + ' skipped (check diameter, length and pieces)' : '') + '. Check them below.'; },
      pasteNone: 'No usable lines. Use columns: diameter, length in metres, pieces, and optionally grade.',
      errors: {
        stock: 'Stock length must be between 1 and 30 m.', kerf: 'Kerf must be 0 to 20 mm.',
        allowance: 'Allowance must be 0 to 200 mm.', minOffcut: 'Reusable offcut length must be between 0 and the stock length.',
        diameter: 'Diameter must be between 4 and 60 mm', length: 'Enter a length in metres', qty: 'Pieces must be a whole number from 1 to 100,000',
        tooLong: 'This piece is longer than the stock bar', tooMany: 'Too many pieces for one run (limit 200,000).',
        empty: 'Add at least one line.'
      },
      line: 'Line', note: 'Nominal weights: 0.006165 × d² kg/m. A planning aid, not a shop drawing or a quotation.',
      reportTitle: 'Rebar cutting plan', settings: 'Settings', stockLbl: 'Stock', kerfLbl: 'Kerf', allowLbl: 'Allowance', minOffLbl: 'Reusable from',
      waHello: 'Hello Omar, here is a rebar cutting plan. Please send a quotation:', waGrade: 'Grade', waCity: 'Project city:', waCompany: 'Company:', waNeedCut: 'Cutting / bending service needed? '
    },
    ar: {
      dia: 'القطر مم', grade: 'الدرجة', len: 'الطول م', qty: 'العدد', remove: 'حذف البند',
      empty: 'أضف أطوال القص المطلوبة، أو الصقها من الإكسل.',
      run: 'احسب أفضل خطة قص', running: 'جاري الحساب…',
      optimal: 'أقل عدد أسياخ ممكن (مُثبَت)',
      optimalNote: 'عدد الأسياخ في الخطة يساوي الحد الأدنى النظري، فلا توجد خطة بعدد أقل. ومع طول سيخ واحد هذا يعني أيضاً أقل هدر ممكن.',
      heuristic: 'خطة جيدة، غير مُثبَت أنها الأقل',
      heuristicNote: function (g) { return 'تزيد على الحد الأدنى النظري بـ ' + g + ' سيخ كحد أقصى في المجموع، والحد الأدنى الحقيقي بينهما.'; },
      bars: 'الأسياخ المطلوبة', util: 'نسبة الاستفادة', waste: 'الهدر', weight: 'الوزن المطلوب شراؤه',
      pcs: 'سيخ', t: 'طن', m: 'م', kg: 'كجم',
      sumHead: ['القطر', 'الدرجة', 'القطع', 'الأسياخ', 'المطلوب م', 'المشترى م', 'الهدر م', 'الهدر ٪', 'قابل للاستخدام م', 'الوزن طن', 'النتيجة'],
      provenShort: 'مُثبَت', heurShort: function (g) { return '+' + g + ' كحد أقصى'; },
      patterns: 'أنماط القص', times: '×', offcut: 'متبقٍ', reusable: 'قابل للاستخدام', scrap: 'سكراب', kerf: 'فاقد القص',
      bar: 'سيخ', perBar: 'لكل سيخ',
      reuseHead: 'بواقي قابلة لإعادة الاستخدام', none: 'لا يوجد',
      showAll: function (n) { return 'اعرض كل الأنماط (' + n + ')'; },
      csv: 'تنزيل CSV', print: 'طباعة / PDF', send: 'أرسل الخطة على واتساب',
      confirmSend: 'سيتم نسخ ملخص خطة القص وفتح محادثة واتساب مع عمر مشهراوي (مبيعات حديد الراجحي). لن يُرسَل شيء إلا إذا لصقته وأرسلته بنفسك. هل تريد المتابعة؟',
      copied: 'تم نسخ الملخص، الصقه في المحادثة.',
      pasteOk: function (n, bad) { return 'تم استيراد ' + n + ' بند' + (bad ? '، وتم تجاهل ' + bad + ' (تحقق من القطر والطول والعدد)' : '') + '. راجعها في الجدول.'; },
      pasteNone: 'لا توجد بنود صالحة. الأعمدة المطلوبة: القطر، الطول بالمتر، العدد، والدرجة اختيارياً.',
      errors: {
        stock: 'طول السيخ يجب أن يكون بين ١ و٣٠ م.', kerf: 'فاقد القص يجب أن يكون من ٠ إلى ٢٠ مم.',
        allowance: 'سماحية القص يجب أن تكون من ٠ إلى ٢٠٠ مم.', minOffcut: 'طول البواقي القابلة للاستخدام يجب أن يكون بين ٠ وطول السيخ.',
        diameter: 'القطر يجب أن يكون بين ٤ و٦٠ مم', length: 'أدخل الطول بالمتر', qty: 'العدد يجب أن يكون رقماً صحيحاً من ١ إلى ١٠٠٬٠٠٠',
        tooLong: 'هذه القطعة أطول من السيخ', tooMany: 'عدد القطع كبير جداً لحساب واحد (الحد ٢٠٠٬٠٠٠).',
        empty: 'أضف بنداً واحداً على الأقل.'
      },
      line: 'البند', note: 'أوزان اسمية: ٠٫٠٠٦١٦٥ × ق² كجم/م. أداة تخطيط، وليست مخطط ورشة ولا عرض سعر.',
      reportTitle: 'خطة قص حديد التسليح', settings: 'الإعدادات', stockLbl: 'طول السيخ', kerfLbl: 'فاقد القص', allowLbl: 'السماحية', minOffLbl: 'البواقي القابلة للاستخدام من',
      waHello: 'السلام عليكم أستاذ عمر، هذه خطة قص حديد، أرجو عرض سعر:', waGrade: 'الدرجة', waCity: 'مدينة المشروع:', waCompany: 'الشركة:', waNeedCut: 'هل تحتاج خدمة القص والثني؟ '
    },
    zh: {
      dia: '直径 mm', grade: '牌号', len: '长度 m', qty: '根数', remove: '删除此行',
      empty: '添加所需下料长度，或从 Excel 粘贴。',
      run: '计算最优下料', running: '计算中…',
      optimal: '已证明为最少用料根数',
      optimalNote: '方案用料根数等于理论下限，不存在用料更少的方案。在单一定尺长度下，这也意味着损耗最小。',
      heuristic: '优良方案，未证明为最少',
      heuristicNote: function (g) { return '合计最多比理论下限多 ' + g + ' 根，真实最优值介于两者之间。'; },
      bars: '定尺钢筋根数', util: '利用率', waste: '损耗', weight: '需采购重量',
      pcs: '根', t: '吨', m: '米', kg: '公斤',
      sumHead: ['直径', '牌号', '件数', '根数', '需用 m', '采购 m', '损耗 m', '损耗 %', '可再用 m', '重量 吨', '结果'],
      provenShort: '已证明', heurShort: function (g) { return '最多 +' + g; },
      patterns: '下料方案', times: '×', offcut: '余料', reusable: '可再用', scrap: '废料', kerf: '锯缝',
      bar: '根', perBar: '每根',
      reuseHead: '可再利用余料', none: '无',
      showAll: function (n) { return '显示全部 ' + n + ' 种方案'; },
      csv: '下载 CSV', print: '打印 / PDF', send: '通过 WhatsApp 发送方案',
      confirmSend: '将复制下料汇总并打开与 Omar Mashharawi（Al Rajhi 钢铁销售）的 WhatsApp 对话。只有您自己粘贴并发送后才会发出。是否继续？',
      copied: '汇总已复制，请粘贴到对话中。',
      pasteOk: function (n, bad) { return '已导入 ' + n + ' 行' + (bad ? '，跳过 ' + bad + ' 行（请检查直径、长度和根数）' : '') + '。请在下表核对。'; },
      pasteNone: '没有可用的行。列顺序：直径、长度（米）、根数，牌号可选。',
      errors: {
        stock: '定尺长度须在 1 到 30 米之间。', kerf: '锯缝须为 0 到 20 毫米。',
        allowance: '加长余量须为 0 到 200 毫米。', minOffcut: '可再用余料长度须在 0 与定尺长度之间。',
        diameter: '直径须在 4 到 60 毫米之间', length: '请输入长度（米）', qty: '根数须为 1 到 100,000 的整数',
        tooLong: '该下料长度超过定尺长度', tooMany: '单次计算件数过多（上限 200,000）。',
        empty: '请至少添加一行。'
      },
      line: '第', note: '理论重量：0.006165 × d² 公斤/米。仅供规划参考，不是加工图，也不是报价。',
      reportTitle: '钢筋下料方案', settings: '参数', stockLbl: '定尺', kerfLbl: '锯缝', allowLbl: '余量', minOffLbl: '可再用余料起',
      waHello: 'Omar 您好，这是钢筋下料方案，请报价：', waGrade: '牌号', waCity: '项目城市：', waCompany: '公司：', waNeedCut: '是否需要切割/弯曲加工？'
    }
  }[L];

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fmt(n, dp) {
    if (!isFinite(n)) return '0';
    return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  function m(mm, dp) { return fmt(mm / 1000, dp == null ? 2 : dp); }

  /* ---- input rows -------------------------------------------------------- */
  var rowsEl = $('coRows'), emptyEl = $('coEmpty'), msgEl = $('coMsg');

  function addRow(r) {
    r = r || {};
    var tr = document.createElement('tr');

    var tdD = el('td');
    var dIn = el('input', 'co-in co-dia');
    dIn.type = 'number'; dIn.min = '4'; dIn.max = '60'; dIn.step = '1'; dIn.inputMode = 'numeric';
    dIn.setAttribute('list', 'coDiaList');
    dIn.setAttribute('aria-label', T.dia);
    dIn.value = r.diameter != null ? r.diameter : (lastDia() || 16);
    tdD.appendChild(dIn);

    var tdG = el('td');
    var gIn = el('input', 'co-in co-grade');
    gIn.type = 'text'; gIn.maxLength = 20; gIn.setAttribute('list', 'coGradeList');
    gIn.setAttribute('aria-label', T.grade);
    gIn.value = r.grade != null ? r.grade : (lastGrade() || 'Gr60');
    tdG.appendChild(gIn);

    var tdL = el('td');
    var lIn = el('input', 'co-in co-len');
    lIn.type = 'text'; lIn.inputMode = 'decimal'; lIn.setAttribute('aria-label', T.len);
    lIn.placeholder = '3.45';
    lIn.value = r.length != null ? r.length : '';
    tdL.appendChild(lIn);

    var tdQ = el('td');
    var qIn = el('input', 'co-in co-qty');
    qIn.type = 'number'; qIn.min = '1'; qIn.step = '1'; qIn.inputMode = 'numeric';
    qIn.setAttribute('aria-label', T.qty);
    qIn.value = r.qty != null ? r.qty : '';
    tdQ.appendChild(qIn);

    var tdX = el('td');
    var x = el('button', 'calc-x', '×');
    x.type = 'button'; x.setAttribute('aria-label', T.remove);
    x.addEventListener('click', function () { tr.remove(); syncEmpty(); });
    tdX.appendChild(x);

    [tdD, tdG, tdL, tdQ, tdX].forEach(function (td) { tr.appendChild(td); });
    rowsEl.appendChild(tr);
    syncEmpty();
    return tr;
  }
  function lastRow() { var r = rowsEl.querySelectorAll('tr'); return r.length ? r[r.length - 1] : null; }
  function lastDia() { var r = lastRow(); return r ? r.querySelector('.co-dia').value : ''; }
  function lastGrade() { var r = lastRow(); return r ? r.querySelector('.co-grade').value : ''; }
  function syncEmpty() { emptyEl.hidden = rowsEl.children.length > 0; }

  function readRows() {
    return [].map.call(rowsEl.querySelectorAll('tr'), function (tr) {
      return {
        diameter: Number(tr.querySelector('.co-dia').value),
        grade: tr.querySelector('.co-grade').value,
        length: CutOpt.metresToMm(tr.querySelector('.co-len').value),
        qty: Number(tr.querySelector('.co-qty').value)
      };
    });
  }

  /* ---- paste from Excel --------------------------------------------------- */
  /* Columns: diameter, length (m), pieces, grade (optional). Tab, semicolon
     or comma separated. Header rows and anything non-numeric are skipped.
     Text only: no formulas are evaluated, nothing leaves the page. */
  function parsePaste(text) {
    var good = [], bad = 0;
    String(text || '').split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var cells = line.split(line.indexOf('\t') >= 0 ? '\t' : (line.indexOf(';') >= 0 ? ';' : ','));
      cells = cells.map(function (c) { return c.trim().replace(/^["']|["']$/g, ''); });
      var d = Number(String(cells[0]).replace(/[^\d.]/g, ''));
      var len = String(cells[1] || '').replace(',', '.');
      var q = Number(String(cells[2] || '').replace(/[^\d]/g, ''));
      var lm = Number(len);
      if (!(d > 0) || !(lm > 0) || !(q > 0)) {
        // a header row is not counted as an error
        if (/[a-zA-Z؀-ۿ一-鿿]/.test(line) && !(d > 0)) return;
        bad++; return;
      }
      // lengths over 100 are taken to be millimetres
      if (lm > 100) lm = lm / 1000;
      good.push({ diameter: d, length: String(+lm.toFixed(3)), qty: q, grade: (cells[3] || '').slice(0, 20) || null });
    });
    return { rows: good, bad: bad };
  }

  $('coPasteGo').addEventListener('click', function () {
    var res = parsePaste($('coPaste').value);
    if (!res.rows.length) { say(T.pasteNone, true); return; }
    // replace the starter line if it is still blank
    [].slice.call(rowsEl.querySelectorAll('tr')).forEach(function (tr) {
      if (!tr.querySelector('.co-len').value && !tr.querySelector('.co-qty').value) tr.remove();
    });
    res.rows.forEach(addRow);
    $('coPaste').value = '';
    say(T.pasteOk(res.rows.length, res.bad), !!res.bad);
  });

  function say(text, warn) {
    msgEl.textContent = text || '';
    msgEl.className = 'co-msg' + (warn ? ' warn' : '');
  }

  /* ---- settings --------------------------------------------------------- */
  function settings() {
    return {
      stockLength: CutOpt.metresToMm($('coStock').value),
      kerf: Math.round(Number($('coKerf').value || 0)),
      allowance: Math.round(Number($('coAllow').value || 0)),
      minOffcut: CutOpt.metresToMm($('coMinOff').value || '0')
    };
  }

  /* ---- run --------------------------------------------------------------- */
  var last = null;

  function run() {
    var s = settings();
    var items = readRows();
    [].forEach.call(rowsEl.querySelectorAll('tr'), function (tr) { tr.classList.remove('co-bad'); });
    var res = CutOpt.optimize(Object.assign({}, s, { items: items }));
    if (!res.ok) {
      var trs = rowsEl.querySelectorAll('tr');
      var msgs = res.errors.slice(0, 4).map(function (e) {
        if (e.line != null) { if (trs[e.line]) trs[e.line].classList.add('co-bad'); return T.line + ' ' + (e.line + 1) + ': ' + T.errors[e.code]; }
        return T.errors[e.code];
      });
      say(msgs.join(' · '), true);
      $('coOut').hidden = true;
      return;
    }
    say('');
    last = res;
    render(res);
  }

  $('coRun').addEventListener('click', function () {
    var b = this;
    b.disabled = true; b.textContent = T.running;
    // let the label paint before a large job
    setTimeout(function () {
      try { run(); } finally { b.disabled = false; b.textContent = T.run; }
      var out = $('coOut');
      if (!out.hidden) out.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }, 30);
  });
  $('coAdd').addEventListener('click', function () { addRow().querySelector('.co-len').focus(); });
  $('coExample').addEventListener('click', function () {
    rowsEl.textContent = '';
    [[16, 'Gr60', '2.35', 96], [16, 'Gr60', '3.60', 64], [16, 'Gr60', '4.25', 40], [12, 'Gr60', '1.95', 220],
     [12, 'Gr60', '5.85', 48], [12, 'Gr60', '7.30', 36], [20, 'Gr60', '6.45', 28], [20, 'Gr60', '3.15', 44]]
      .forEach(function (r) { addRow({ diameter: r[0], grade: r[1], length: r[2], qty: r[3] }); });
    say('');
  });

  /* ---- render ------------------------------------------------------------ */
  function render(res) {
    var out = $('coOut');
    out.hidden = false;
    var t = res.totals;

    var st = $('coStatus');
    st.textContent = '';
    st.className = 'co-status ' + (t.allOptimal ? 'ok' : 'heur');
    st.appendChild(el('b', null, t.allOptimal ? T.optimal : T.heuristic));
    var gap = res.groups.reduce(function (a, g) { return a + g.gap; }, 0);
    st.appendChild(el('span', null, t.allOptimal ? T.optimalNote : T.heuristicNote(gap)));

    $('fBars').textContent = fmt(t.bars, 0);
    $('fUtil').textContent = fmt(t.utilisationPct, 2);
    $('fWaste').textContent = fmt(t.wastePct, 2);
    $('fWt').textContent = fmt(t.weightPurchasedKg / 1000, 3);
    $('fBarsLbl').textContent = T.bars + ' · ' + m(res.settings.stock, 2).replace(/\.?0+$/, '') + ' ' + T.m;

    // summary table
    var tb = $('coSum');
    tb.textContent = '';
    res.groups.forEach(function (g) {
      var tr = document.createElement('tr');
      [String(g.diameter), g.grade || '—', fmt(g.pieces, 0), fmt(g.bars, 0), m(g.requiredLength), m(g.purchasedLength),
       m(g.wasteLength), fmt(g.wastePct, 2), m(g.reusableLength), fmt(g.weightPurchasedKg / 1000, 3),
       g.optimal ? T.provenShort : T.heurShort(g.gap)].forEach(function (v, i) {
        var td = el('td', i >= 2 && i <= 9 ? 'num' : (i === 10 ? (g.optimal ? 'co-ok' : 'co-heur') : ''), v);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    var tf = $('coSumFoot');
    tf.textContent = '';
    var ftr = document.createElement('tr');
    var th = el('th', null, '');
    th.colSpan = 2; th.scope = 'row';
    ftr.appendChild(th);
    [fmt(t.pieces, 0), fmt(t.bars, 0), m(t.requiredLength), m(t.purchasedLength), m(t.wasteLength),
     fmt(t.wastePct, 2), m(t.reusableLength), fmt(t.weightPurchasedKg / 1000, 3), ''].forEach(function (v) {
      ftr.appendChild(el('td', 'num', v));
    });
    tf.appendChild(ftr);

    // patterns
    var box = $('coPatterns');
    box.textContent = '';
    res.groups.forEach(function (g) {
      var sec = el('section', 'co-grp');
      var h = el('h3', 'co-grp-h');
      h.appendChild(el('span', 'co-grp-d', 'Ø' + g.diameter + (g.grade ? ' · ' + g.grade : '')));
      h.appendChild(el('span', 'co-grp-n', fmt(g.bars, 0) + ' × ' + m(res.settings.stock, 0) + ' ' + T.m + ' · ' + fmt(g.weightPurchasedKg / 1000, 3) + ' ' + T.t + ' · ' + T.waste + ' ' + fmt(g.wastePct, 2) + '%'));
      sec.appendChild(h);

      var list = el('ol', 'co-pats');
      var LIMIT = 30;
      g.patterns.forEach(function (p, i) {
        var li = el('li', 'co-pat' + (i >= LIMIT ? ' co-more' : ''));
        if (i >= LIMIT) li.hidden = true;
        li.appendChild(el('span', 'co-pat-n', T.times + fmt(p.count, 0)));
        var bar = el('div', 'co-bar');
        bar.setAttribute('role', 'img');
        var desc = p.cuts.map(function (c) { return m(c); }).join(' + ') + ' ' + T.m;
        if (p.offcut) desc += ' · ' + T.offcut + ' ' + m(p.offcut) + ' ' + T.m;
        bar.setAttribute('aria-label', desc);
        p.cuts.forEach(function (c) {
          var seg = el('span', 'co-seg', m(c));
          seg.style.flexBasis = (c / res.settings.stock * 100) + '%';
          bar.appendChild(seg);
        });
        if (p.kerf > 0) {
          var k = el('span', 'co-kerf');
          k.style.flexBasis = (p.kerf / res.settings.stock * 100) + '%';
          bar.appendChild(k);
        }
        if (p.offcut > 0) {
          var o = el('span', 'co-off' + (p.reusable ? ' re' : ''), p.offcut / res.settings.stock > 0.06 ? m(p.offcut) : '');
          o.style.flexBasis = (p.offcut / res.settings.stock * 100) + '%';
          o.title = (p.reusable ? T.reusable : T.scrap) + ' ' + m(p.offcut) + ' ' + T.m;
          bar.appendChild(o);
        }
        li.appendChild(bar);
        li.appendChild(el('span', 'co-pat-o', p.offcut ? (m(p.offcut) + ' ' + T.m + ' ' + (p.reusable ? T.reusable : T.scrap)) : '0'));
        list.appendChild(li);
      });
      sec.appendChild(list);
      if (g.patterns.length > LIMIT) {
        var more = el('button', 'calc-btn ghost co-showall', T.showAll(g.patterns.length));
        more.type = 'button';
        more.addEventListener('click', function () {
          [].forEach.call(list.querySelectorAll('.co-more'), function (li) { li.hidden = false; });
          more.remove();
        });
        sec.appendChild(more);
      }
      if (g.reusableOffcuts.length) {
        var ro = el('p', 'co-reuse');
        ro.appendChild(el('b', null, T.reuseHead + ': '));
        ro.appendChild(document.createTextNode(g.reusableOffcuts.map(function (o) {
          return m(o.length) + ' ' + T.m + ' ' + T.times + o.count;
        }).join(' · ')));
        sec.appendChild(ro);
      }
      box.appendChild(sec);
    });

    $('coDate').textContent = new Date().toISOString().slice(0, 10);
    $('coSet').textContent = T.stockLbl + ' ' + m(res.settings.stock, 2) + ' ' + T.m + ' · ' + T.kerfLbl + ' ' + res.settings.kerf + ' mm · ' +
      T.allowLbl + ' ' + res.settings.allowance + ' mm · ' + T.minOffLbl + ' ' + m(res.settings.minOffcut) + ' ' + T.m;
  }

  /* ---- exports ----------------------------------------------------------- */
  // Cells starting with = + - @ are prefixed so a spreadsheet never runs them.
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(res) {
    var rows = [];
    rows.push(['Section', 'Diameter mm', 'Grade', 'Bars', 'Pattern cuts (m)', 'Pieces per bar', 'Kerf mm', 'Offcut m', 'Offcut type']);
    res.groups.forEach(function (g) {
      g.patterns.forEach(function (p) {
        rows.push(['pattern', g.diameter, g.grade, p.count, p.cuts.map(function (c) { return m(c, 3); }).join(' + '), p.pieces, p.kerf, m(p.offcut, 3), p.offcut ? (p.reusable ? 'reusable' : 'scrap') : '']);
      });
    });
    rows.push([]);
    rows.push(['Section', 'Diameter mm', 'Grade', 'Pieces', 'Bars', 'Required m', 'Purchased m', 'Waste m', 'Waste %', 'Reusable m', 'Weight kg', 'Lower bound bars', 'Proven minimum']);
    res.groups.forEach(function (g) {
      rows.push(['summary', g.diameter, g.grade, g.pieces, g.bars, m(g.requiredLength, 3), m(g.purchasedLength, 3), m(g.wasteLength, 3),
        g.wastePct.toFixed(2), m(g.reusableLength, 3), g.weightPurchasedKg.toFixed(1), g.lowerBound, g.optimal ? 'yes' : 'no']);
    });
    rows.push(['settings', 'stock m ' + m(res.settings.stock, 3), 'kerf mm ' + res.settings.kerf, 'allowance mm ' + res.settings.allowance, 'reusable from m ' + m(res.settings.minOffcut, 3)]);
    rows.push(['note', 'Nominal weights 0.006165 x d^2 kg/m. Planning aid, not a quotation. mashharawi.com/tools/cutting-optimizer/']);
    return '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }
  $('coCsv').addEventListener('click', function () {
    if (!last) return;
    var blob = new Blob([toCsv(last)], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cutting-plan-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
  $('coPrint').addEventListener('click', function () { window.print(); });

  $('coSend').addEventListener('click', function () {
    if (!last) return;
    if (!window.confirm(T.confirmSend)) return;
    var lines = [T.waHello];
    last.groups.forEach(function (g) {
      lines.push('Ø' + g.diameter + (g.grade ? ' ' + g.grade : '') + ': ' + g.bars + ' × ' + m(last.settings.stock, 0) + ' ' + T.m +
        ' = ' + fmt(g.weightPurchasedKg / 1000, 3) + ' ' + T.t);
    });
    lines.push((L === 'en' ? 'Total: ' : (L === 'ar' ? 'الإجمالي: ' : '合计：')) + fmt(last.totals.bars, 0) + ' ' + T.pcs + ' · ' + fmt(last.totals.weightPurchasedKg / 1000, 3) + ' ' + T.t);
    lines.push(T.waNeedCut);
    lines.push(T.waCity);
    lines.push(T.waCompany);
    var text = lines.join('\n');
    var b = this, label = b.textContent;
    try { navigator.clipboard.writeText(text).then(function () { b.textContent = T.copied; }, function () {}); } catch (e) { /* no clipboard */ }
    setTimeout(function () { b.textContent = label; }, 6000);
    window.open(WA, '_blank', 'noopener');
  });

  /* ---- start ------------------------------------------------------------- */
  var dl = $('coDiaList');
  DIAS.forEach(function (d) { var o = document.createElement('option'); o.value = d; dl.appendChild(o); });
  addRow({ diameter: 16, grade: 'Gr60' });
})();
