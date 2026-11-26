/* Smart RFQ Generator page. Everything stays in this tab: no storage, no
   network, no form submission. User text is only ever written with
   textContent or as a value, never as HTML. WhatsApp and email open only
   when the user presses the button, after reviewing the RFQ. */
(function () {
  'use strict';
  var root = document.getElementById('rfq');
  if (!root || !window.Rfq || !window.RfqText) return;
  var R = window.Rfq, LANG = root.getAttribute('data-lang') || 'en', T = window.RfqText[LANG];
  var $ = function (id) { return document.getElementById(id); };
  var linesEl = $('rLines'), tpl = $('rLineTpl'), sumEl = $('rSum'), doc = $('rDoc'), share = $('rShare'), msg = $('rMsg');
  var touched = {}, lineSeq = 0, ref = null, previewed = null, showAll = false;

  function today() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function radio(name) { var r = root.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; }
  function val(id) { return $(id).value; }

  /* ---- product lines ----------------------------------------------------------- */
  function fillSelect(sel, values, label, keep) {
    while (sel.options.length > 1) sel.remove(1);
    values.forEach(function (v) { var o = el('option', null, label(v)); o.value = String(v); sel.appendChild(o); });
    sel.value = keep != null && values.map(String).indexOf(String(keep)) >= 0 ? String(keep) : '';
  }
  function setupType(li, announce) {
    var type = li.querySelector('[data-k="type"]').value, dia = li.querySelector('[data-k="dia"]'), grade = li.querySelector('[data-k="grade"]');
    var prod = R.PRODUCTS[type];
    var before = dia.value + '|' + grade.value;
    if (!prod) {
      fillSelect(dia, [], null); fillSelect(grade, [], null);
      dia.disabled = grade.disabled = true;
    } else if (prod.fixed) {
      // the 8 mm cold-rolled product has one diameter and one grade
      fillSelect(dia, prod.dias, function (d) { return d + ' ' + T.mm; }, prod.dias[0]);
      fillSelect(grade, prod.grades, function (g) { return T.grade[g]; }, prod.grades[0]);
      dia.disabled = grade.disabled = true;
    } else {
      // keep a selection only if it is offered for the new type; never substitute
      fillSelect(dia, prod.dias, function (d) { return d + ' ' + T.mm; }, dia.value);
      fillSelect(grade, prod.grades, function (g) { return T.grade[g]; }, grade.value);
      dia.disabled = grade.disabled = false;
    }
    li.querySelector('.r-line__len').textContent = prod ? T.length[type] : '–';
    li.querySelector('.r-note--fixed').hidden = !(prod && prod.fixed);
    li.querySelector('.r-note--epoxy').hidden = !(prod && prod.confirm);
    var after = dia.value + '|' + grade.value;
    if (announce && before !== '|' && after !== before && !(prod && prod.fixed)) say(T.typeChanged);
  }
  function addLine(focus) {
    if (linesEl.children.length >= R.LIMITS.lines) { say(T.err.maxLines); return; }
    var li = tpl.content.firstElementChild.cloneNode(true);
    var id = 'l' + (++lineSeq);
    li.setAttribute('data-line', id);
    Array.prototype.forEach.call(li.querySelectorAll('.r-field'), function (f) {
      var ctl = f.querySelector('[data-k]'), lab = f.querySelector('label'), err = f.querySelector('.r-err');
      ctl.id = id + '-' + ctl.getAttribute('data-k'); lab.htmlFor = ctl.id;
      err.id = ctl.id + '-err'; ctl.setAttribute('aria-describedby', err.id);
    });
    li.querySelector('[data-k="date"]').min = today();
    setupType(li, false);
    linesEl.appendChild(li);
    renumber();
    if (focus) { li.querySelector('[data-k="type"]').focus(); say(T.lineAdded(linesEl.children.length)); }
    update();
  }
  function renumber() {
    Array.prototype.forEach.call(linesEl.children, function (li, i) {
      li.querySelector('.r-line__n').textContent = String(i + 1);
      li.querySelector('.r-remove').setAttribute('aria-label', li.querySelector('.r-remove').textContent.trim() + ' ' + (i + 1));
    });
  }
  linesEl.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.r-remove');
    if (!b) return;
    var li = b.closest('.r-line'), n = Array.prototype.indexOf.call(linesEl.children, li) + 1;
    li.remove(); renumber();
    var next = linesEl.children[n - 1] || linesEl.children[n - 2];
    (next ? next.querySelector('[data-k="type"]') : $('rAdd')).focus();
    say(T.lineRemoved(n));
    update();
  });
  linesEl.addEventListener('change', function (e) {
    var t = e.target;
    if (t.getAttribute('data-k') === 'type') setupType(t.closest('.r-line'), true);
  });
  $('rAdd').addEventListener('click', function () { addLine(true); });

  /* ---- state and validation --------------------------------------------------- */
  function collect() {
    return {
      customer: { company: val('c-company'), contact: val('c-contact'), email: val('c-email'), phone: val('c-phone'), country: val('c-country'), city: val('c-city') },
      project: { name: val('p-name'), location: val('p-location'), site: val('p-site'), date: val('p-date'), schedule: radio('p-schedule'), notes: val('p-notes') },
      lines: Array.prototype.map.call(linesEl.children, function (li) {
        var g = function (k) { return li.querySelector('[data-k="' + k + '"]').value; };
        return { type: g('type'), dia: g('dia'), grade: g('grade'), qty: g('qty'), date: g('date'), notes: g('notes') };
      }),
      payment: radio('payment')
    };
  }
  var FIELD = { 'customer.company': 'c-company', 'customer.contact': 'c-contact', 'customer.email': 'c-email', 'customer.phone': 'c-phone',
                'customer.country': 'c-country', 'customer.city': 'c-city', 'project.name': 'p-name', 'project.location': 'p-location',
                'project.site': 'p-site', 'project.date': 'p-date', 'project.schedule': 'p-schedule', 'project.notes': 'p-notes', payment: 'payment', lines: 'lines' };
  function controlId(path) {
    if (FIELD[path]) return FIELD[path];
    var m = /^lines\.(\d+)\.(\w+)$/.exec(path);
    if (!m) return null;
    var li = linesEl.children[+m[1]];
    return li ? li.getAttribute('data-line') + '-' + m[2] : null;
  }
  function message(code) { return T.err[code] || code; }
  function labelFor(id) {
    var c = $(id);
    if (!c) return '';
    if (c.tagName === 'FIELDSET') return c.querySelector('legend').firstChild.textContent.trim();
    var lab = root.querySelector('label[for="' + id + '"]');
    var t = lab ? lab.firstChild.textContent.trim() : '';
    var li = c.closest && c.closest('.r-line');
    return li ? T.f.line + ' ' + li.querySelector('.r-line__n').textContent + ': ' + t : t;
  }

  function showErrors(v) {
    var byId = {};
    v.errors.forEach(function (e) { var id = controlId(e.path); if (id && !byId[id]) byId[id] = e.code; });
    Array.prototype.forEach.call(root.querySelectorAll('.r-err'), function (p) {
      var id = p.id.replace(/-err$/, ''), code = byId[id];
      var show = code && (showAll || touched[id]);
      p.hidden = !show; p.textContent = show ? message(code) : '';
      var c = $(id);
      if (c && c.tagName !== 'FIELDSET' && c.tagName !== 'P') { if (show) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid'); }
    });
    return byId;
  }

  function renderSummary(v) {
    while (sumEl.firstChild) sumEl.removeChild(sumEl.firstChild);
    var s = v.summary;
    var dl = el('dl', 'r-sumfig');
    var add = function (dt, dd) { dl.appendChild(el('dt', null, dt)); dl.appendChild(el('dd', null, dd)); };
    add(T.sum.lines, s.lines + ' (' + s.validLines + ' ' + T.sum.complete + ')');
    add(T.sum.total, R.fmtT(s.totalKg) + ' ' + T.unit);
    sumEl.appendChild(dl);
    if (s.breakdown.length) {
      sumEl.appendChild(el('p', 'calc-lbl', T.sum.breakdown));
      var tb = el('table', 'calc-table r-break'), body = el('tbody');
      s.breakdown.forEach(function (g) {
        var tr = el('tr');
        tr.appendChild(el('td', null, T.typeShort[g.type]));
        tr.appendChild(el('td', null, g.dia + ' ' + T.mm));
        tr.appendChild(el('td', null, T.grade[g.grade]));
        tr.appendChild(el('td', 'r-num', R.fmtT(g.kg) + ' ' + T.unit));
        body.appendChild(tr);
      });
      tb.appendChild(body); sumEl.appendChild(tb);
    } else sumEl.appendChild(el('p', 'r-muted', T.sum.none));
    if (s.incomplete) sumEl.appendChild(el('p', 'r-muted', T.sum.incomplete(s.incomplete)));
    if (v.warnings.length) {
      var ul = el('ul', 'r-warn');
      v.warnings.forEach(function (w) {
        var t = w.code === 'duplicate' ? T.warn.duplicate(w.lines[0], w.lines[1]) : w.code === 'epoxy' ? T.f.line + ' ' + w.lines[0] + ': ' + T.warn.epoxy : T.warn[w.code];
        ul.appendChild(el('li', null, t));
      });
      sumEl.appendChild(ul);
    }
  }

  var current = null;
  function update() {
    current = R.validate(collect(), today());
    renderSummary(current);
    showErrors(current);
    if (previewed !== null) {
      var stale = JSON.stringify(collect()) !== previewed;
      $('rStale').hidden = !stale;
      $('rStale').textContent = stale ? T.stale : '';
      share.classList.toggle('r-is-stale', stale);
    }
    return current;
  }
  root.addEventListener('input', function (e) { if (e.target.id !== 'rReviewed') update(); });
  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'rReviewed') return;
    markTouched(t);
    update();
  });
  root.addEventListener('focusout', function (e) { if (e.target.matches && e.target.matches('.r-in')) { markTouched(e.target); update(); } });
  function markTouched(t) {
    if (t.type === 'radio') touched[t.name] = true;
    else if (t.id) touched[t.id] = true;
  }

  /* ---- preview ------------------------------------------------------------------- */
  function randomBytes() {
    var b = new Uint8Array(5);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (var i = 0; i < 5; i++) b[i] = Math.floor(Math.random() * 256);
    return b;
  }
  function errorSummary(v) {
    var box = $('rErrSum'), ul = box.querySelector('ul');
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    var seen = {};
    v.errors.forEach(function (e) {
      var id = controlId(e.path);
      if (!id || seen[id]) return;
      seen[id] = true;
      var lbl = labelFor(id), li = el('li'), a = el('a', null, (lbl ? lbl + ': ' : '') + message(e.code));
      a.href = '#' + id;
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var c = $(id), target = c && (c.tagName === 'FIELDSET' ? c.querySelector('input') : c);
        if (id === 'lines') target = $('rAdd');
        if (target) { target.focus(); target.scrollIntoView({ block: 'center' }); }
      });
      li.appendChild(a); ul.appendChild(li);
    });
    box.querySelector('p').textContent = T.fix(ul.children.length) + ' ';
    box.hidden = false; box.focus();
  }
  // phone numbers, emails, dates and the reference keep left-to-right order
  // inside Arabic text
  function bdi(text) { var b = el('bdi', null, text); b.dir = 'ltr'; return b; }
  function dlRows(pairs) {
    var dl = el('dl', 'r-doc__dl');
    pairs.forEach(function (p) {
      dl.appendChild(el('dt', null, p[0]));
      var v = String(p[1] == null ? '' : p[1]).trim(), dd = el('dd');
      if (!v) dd.textContent = T.pv.notGiven; else if (p[2]) dd.appendChild(bdi(v)); else dd.textContent = v;
      dl.appendChild(dd);
    });
    return dl;
  }
  function buildPreview(state, v, date) {
    while (doc.firstChild) doc.removeChild(doc.firstChild);
    var c = state.customer, p = state.project;
    var head = el('div', 'r-doc__head');
    head.appendChild(el('h3', 'r-doc__title', T.title));
    var meta = el('p', 'r-doc__meta');
    meta.appendChild(el('b', null, T.pv.ref + ': ')); var r = bdi(ref); r.className = 'r-ref'; meta.appendChild(r);
    meta.appendChild(document.createTextNode(' · ' + T.pv.date + ': ')); meta.appendChild(bdi(date));
    meta.appendChild(document.createTextNode(' · ' + T.pv.to + ': ')); meta.appendChild(bdi('Al Rajhi Steel'));
    head.appendChild(meta);
    head.appendChild(el('p', 'r-doc__small', T.pv.refNote));
    doc.appendChild(head);
    var two = el('div', 'r-doc__two');
    var a = el('section'); a.appendChild(el('h4', null, T.pv.customer));
    a.appendChild(dlRows([[T.f.company, c.company], [T.f.contact, c.contact], [T.f.phone, c.phone, true], [T.f.email, c.email, true], [T.f.city, c.city], [T.f.country, c.country]]));
    var b = el('section'); b.appendChild(el('h4', null, T.pv.project));
    b.appendChild(dlRows([[T.f.project, p.name], [T.f.location, p.location]]));
    two.appendChild(a); two.appendChild(b); doc.appendChild(two);

    doc.appendChild(el('h4', null, T.pv.products));
    var wrap = el('div', 'r-doc__scroll'), tb = el('table', 'r-doc__table'), thead = el('thead'), hr = el('tr');
    [T.pv.no, T.f.type, T.f.dia, T.f.gradeF, T.pv.length, T.pv.qty, T.f.lineDate, T.pv.lineNotes].forEach(function (h) { var th = el('th', null, h); th.scope = 'col'; hr.appendChild(th); });
    thead.appendChild(hr); tb.appendChild(thead);
    var body = el('tbody');
    v.lines.forEach(function (l) {
      var tr = el('tr');
      tr.appendChild(el('td', null, String(l.n)));
      var td = el('td', null, T.type[l.type]);
      if (R.PRODUCTS[l.type].confirm) td.appendChild(el('span', 'r-doc__flag', ' (' + T.pv.confirm + ')'));
      tr.appendChild(td);
      tr.appendChild(el('td', null, l.dia + ' ' + T.mm));
      tr.appendChild(el('td', null, T.grade[l.grade]));
      tr.appendChild(el('td', null, T.length[l.type]));
      tr.appendChild(el('td', 'r-num', R.fmtT(l.kg)));
      var dtd = el('td'); if (l.date) dtd.appendChild(bdi(l.date)); else dtd.textContent = '–'; tr.appendChild(dtd);
      tr.appendChild(el('td', null, l.notes || '–'));
      body.appendChild(tr);
    });
    tb.appendChild(body);
    var tf = el('tfoot'), fr = el('tr'), th = el('th', null, T.pv.total); th.colSpan = 5; th.scope = 'row';
    fr.appendChild(th); fr.appendChild(el('td', 'r-num', R.fmtT(v.summary.totalKg))); fr.appendChild(el('td')); fr.appendChild(el('td'));
    tf.appendChild(fr); tb.appendChild(tf);
    wrap.appendChild(tb); doc.appendChild(wrap);
    if (v.summary.breakdown.length > 1) {
      doc.appendChild(el('p', 'r-doc__sub', T.sum.breakdown));
      var ul = el('ul', 'r-doc__break');
      v.summary.breakdown.forEach(function (g) { ul.appendChild(el('li', null, T.typeShort[g.type] + ' · ' + g.dia + ' ' + T.mm + ' · ' + T.grade[g.grade] + ': ' + R.fmtT(g.kg) + ' ' + T.unit)); });
      doc.appendChild(ul);
    }
    var two2 = el('div', 'r-doc__two');
    var d = el('section'); d.appendChild(el('h4', null, T.pv.delivery));
    d.appendChild(dlRows([[T.f.site, p.site], [T.f.date, p.date, true], [T.f.schedule, T.schedule[p.schedule]]]));
    var pay = el('section'); pay.appendChild(el('h4', null, T.pv.payment)); pay.appendChild(el('p', null, T.payment[state.payment]));
    two2.appendChild(d); two2.appendChild(pay); doc.appendChild(two2);
    if (String(p.notes || '').trim()) { doc.appendChild(el('h4', null, T.pv.notes)); doc.appendChild(el('p', 'r-doc__notes', String(p.notes).trim())); }
    doc.appendChild(el('h4', null, T.pv.commercial));
    var cn = el('ul', 'r-doc__cn'); cn.appendChild(el('li', null, T.paymentNote)); cn.appendChild(el('li', null, T.transportNote)); doc.appendChild(cn);
    doc.appendChild(el('p', 'r-doc__disclaimer', T.disclaimer));
    doc.appendChild(el('p', 'r-doc__foot', 'mashharawi.com'));
  }
  $('rPreviewBtn').addEventListener('click', function () {
    showAll = true;
    var state = collect(), v = update();
    if (!v.ok) { doc.hidden = true; share.hidden = true; previewed = null; errorSummary(v); return; }
    $('rErrSum').hidden = true;
    var date = today();
    if (!ref) ref = R.makeRef(date, randomBytes());
    buildPreview(state, v, date);
    $('rText').value = R.buildText(state, v, T, ref, date);
    var n = $('rText').value.length;
    $('rLen').textContent = T.waCount(n, R.WA_TEXT_MAX);
    $('rLen').classList.toggle('r-len--over', n > R.WA_TEXT_MAX);
    previewed = JSON.stringify(state);
    doc.hidden = false; share.hidden = false;
    $('rReviewed').checked = false;
    $('rStale').hidden = true; share.classList.remove('r-is-stale');
    this.textContent = this.getAttribute('data-again');
    say('');
    doc.focus(); doc.scrollIntoView({ block: 'start' });
  });

  /* ---- export and share ----------------------------------------------------------- */
  // messages stay until the next action: instructions such as “paste it” must not disappear
  function say(t) { msg.textContent = t; }
  function ready(needReview) {
    if (previewed === null) return false;
    if (JSON.stringify(collect()) !== previewed) { say(T.stale); return false; }
    if (needReview && !$('rReviewed').checked) { say(T.reviewFirst); $('rReviewed').focus(); return false; }
    return true;
  }
  // Copies the complete RFQ text; done(true) only when the copy succeeded.
  // If both clipboard routes fail, the text is left selected in the box so
  // the user can copy it by hand.
  function copyText(text, done) {
    var ta = $('rText');
    var fallback = function () {
      ta.focus(); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      if (!ok) { ta.focus(); ta.select(); }
      done(ok);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    else fallback();
  }
  $('rPrint').addEventListener('click', function () { if (ready(false)) window.print(); });
  $('rCopy').addEventListener('click', function () {
    if (!ready(false)) return;
    copyText($('rText').value, function (ok) { say(ok ? T.copied : T.copySelect); });
  });
  $('rWa').addEventListener('click', function () {
    if (!ready(true)) return;
    var text = $('rText').value, url = R.waUrl(text);
    if (!url) {
      // too long: never open WhatsApp with a cut message; copy the whole text instead
      copyText(text, function (ok) { say(ok ? T.waLong(text.length, R.WA_TEXT_MAX) : T.copySelect); });
      return;
    }
    var w = window.open(url, '_blank', 'noopener');
    if (w) { try { w.opener = null; } catch (e) { /* ignore */ } }
  });
  $('rMail').addEventListener('click', function () {
    if (!ready(true)) return;
    var state = collect(), subject = T.subject(ref, String(state.project.name).trim()), text = $('rText').value;
    var url = R.mailtoUrl(subject, text);
    if (url) { window.location.href = url; return; }
    // too long for a mailto link: copy the complete text first, and open the
    // email (with a note to paste) only if the copy succeeded
    copyText(text, function (ok) {
      if (!ok) { say(T.copySelect); return; }
      say(T.mailLong);
      window.location.href = R.shortMailto(subject, T.mailBody(ref));
    });
  });

  /* ---- clear (two presses), and no restored values after a reload ----------------- */
  var clearBtn = $('rClear'), armed = 0;
  clearBtn.addEventListener('click', function () {
    if (!armed) {
      clearBtn.textContent = clearBtn.getAttribute('data-again'); armed = setTimeout(function () { armed = 0; clearBtn.textContent = clearBtn.getAttribute('data-first'); }, 4000);
      return;
    }
    clearTimeout(armed); armed = 0; clearBtn.textContent = clearBtn.getAttribute('data-first');
    resetAll();
    $('c-company').focus();
  });
  function resetAll() {
    Array.prototype.forEach.call(root.querySelectorAll('input, textarea'), function (i) {
      if (i.type === 'radio' || i.type === 'checkbox') i.checked = false; else i.value = '';
    });
    while (linesEl.firstChild) linesEl.removeChild(linesEl.firstChild);
    touched = {}; showAll = false; ref = null; previewed = null;
    while (doc.firstChild) doc.removeChild(doc.firstChild);
    doc.hidden = true; share.hidden = true; $('rErrSum').hidden = true;
    $('rPreviewBtn').textContent = $('rPreviewBtn').getAttribute('data-first');
    addLine(false);
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted) resetAll(); });

  $('p-date').min = today();
  resetAll();
})();
