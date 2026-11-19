/* Construction Dictionary page. The cards are already in the HTML (so the
   page works and is readable without JavaScript); this script loads the
   local terms.json, then searches, filters, highlights and copies.
   Nothing typed here leaves the browser and nothing is stored. Text is
   written with textContent and created elements only, never as HTML. */
(function () {
  'use strict';
  var root = document.getElementById('cd');
  if (!root || !window.CDict) return;
  var D = window.CDict;
  var LANG = root.getAttribute('data-lang') || 'en';
  var T = (window.CDictText || {})[LANG] || (window.CDictText || {}).en;
  var $ = function (id) { return document.getElementById(id); };

  var q = $('cdQ'), clear = $('cdClear'), reset = $('cdReset'), count = $('cdCount'),
      empty = $('cdEmpty'), list = $('cdList'), toast = $('cdToast');
  var cards = {};
  Array.prototype.forEach.call(list.querySelectorAll('.cd-card'), function (c) { cards[c.getAttribute('data-id')] = c; });
  var catButtons = Array.prototype.slice.call(root.querySelectorAll('.cd-cats .calc-chip'));
  var state = { q: '', cat: '' }, index = null, terms = {}, order = [];

  function failed() {
    root.classList.add('cd-nosearch');
    count.textContent = T.loadFail;
  }

  /* ---- data ------------------------------------------------------------------ */
  var url = root.getAttribute('data-src');
  if (!window.fetch) { failed(); return; }
  fetch(url, { credentials: 'same-origin' }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (data) {
    index = D.buildIndex(data);
    data.terms.forEach(function (t) { terms[t.id] = t; });
    order = data.terms.map(function (t) { return t.id; });
    root.classList.add('cd-ready');
    q.disabled = false;
    update();
    openFromHash();
  }).catch(failed);

  /* ---- highlighting ------------------------------------------------------------ */
  function setText(el, text, query) {
    var ranges = query ? D.highlightRanges(text, query) : [];
    while (el.firstChild) el.removeChild(el.firstChild);
    var at = 0;
    ranges.forEach(function (r) {
      if (r[0] > at) el.appendChild(document.createTextNode(text.slice(at, r[0])));
      var m = document.createElement('mark');
      m.textContent = text.slice(r[0], r[1]);
      el.appendChild(m);
      at = r[1];
    });
    if (at < text.length) el.appendChild(document.createTextNode(text.slice(at)));
    return ranges.length > 0;
  }
  function fieldText(t, f, l) {
    if (f === 'term') return t.term[l];
    if (f === 'def') return t.definition[l];
    if (f === 'syn') return (t.synonyms[l] || []).join(' · ');
    return '';
  }
  function paint(id, query) {
    var c = cards[id], t = terms[id];
    if (!c || !t) return;
    var hidden = false;
    Array.prototype.forEach.call(c.querySelectorAll('[data-f]'), function (el) {
      var hit = setText(el, fieldText(t, el.getAttribute('data-f'), el.getAttribute('data-l')), query);
      if (hit && el.closest('details')) hidden = true;
    });
    // a match only in the synonyms or another language's definition is
    // inside the closed details: open them so the reason is visible
    var det = c.querySelector('details.cd-more');
    if (det && !det.hasAttribute('data-user')) det.open = !!(query && hidden);
  }

  /* ---- search and filter ----------------------------------------------------- */
  function update() {
    if (!index) return;
    var res = D.search(index, state.q, { category: state.cat, lang: LANG });
    var shown = {};
    res.results.forEach(function (r) { shown[r.id] = true; });
    // order: by score while searching, the page's own order otherwise
    var ids = state.q ? res.results.map(function (r) { return r.id; }) : order.filter(function (id) { return shown[id]; });
    var frag = document.createDocumentFragment();
    ids.forEach(function (id) { if (cards[id]) frag.appendChild(cards[id]); });
    order.forEach(function (id) { if (!shown[id] && cards[id]) frag.appendChild(cards[id]); });
    list.appendChild(frag);
    order.forEach(function (id) {
      var c = cards[id];
      if (!c) return;
      c.hidden = !shown[id];
      if (shown[id] || c.hasAttribute('data-painted')) paint(id, state.q);
      if (state.q) c.setAttribute('data-painted', ''); else c.removeAttribute('data-painted');
    });
    var total = index.entries.length;
    count.textContent = T.count(ids.length, total);
    empty.hidden = ids.length > 0;
    clear.hidden = !state.q;
    reset.disabled = !state.q && !state.cat;
    catButtons.forEach(function (b) {
      var cat = b.getAttribute('data-cat');
      b.setAttribute('aria-pressed', String(cat === state.cat));
      var n = b.querySelector('.cd-n');
      if (n) n.textContent = cat ? (res.counts[cat] || 0) : res.total;
    });
  }

  q.addEventListener('input', function () { state.q = q.value; update(); });
  q.addEventListener('keydown', function (e) { if (e.key === 'Escape' && q.value) { e.preventDefault(); q.value = ''; state.q = ''; update(); } });
  clear.addEventListener('click', function () { q.value = ''; state.q = ''; update(); q.focus(); });
  catButtons.forEach(function (b) {
    b.addEventListener('click', function () { state.cat = b.getAttribute('data-cat'); update(); });
  });
  function resetAll() { q.value = ''; state.q = ''; state.cat = ''; update(); q.focus(); }
  reset.addEventListener('click', resetAll);
  var emptyReset = $('cdEmptyReset');
  if (emptyReset) emptyReset.addEventListener('click', resetAll);

  // remember that the reader opened or closed "more" themselves
  list.addEventListener('click', function (e) {
    var s = e.target.closest && e.target.closest('summary');
    if (s && s.parentNode.classList.contains('cd-more')) s.parentNode.setAttribute('data-user', '');
  });

  /* ---- copy ---------------------------------------------------------------- */
  var toastTimer;
  function say(text) {
    toast.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.textContent = ''; }, 2500);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function copy(text, label) {
    var done = function () { say(T.copied(label)); };
    var fail = function () { if (fallbackCopy(text)) done(); else say(T.copyFail); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fail);
    else fail();
  }
  list.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copy]');
    if (!b) return;
    var card = b.closest('.cd-card'), t = terms[card && card.getAttribute('data-id')];
    if (!t) return;
    var which = b.getAttribute('data-copy');
    var text = D.copyText(t, which);
    copy(text, which === 'all' ? text.replace(/\n/g, ' · ') : text);
  });

  /* ---- related terms and links to one term ------------------------------------- */
  function showTerm(id, focus) {
    var c = cards[id];
    if (!c) return;
    if (c.hidden) { q.value = ''; state.q = ''; state.cat = ''; update(); }
    c.classList.remove('cd-flash'); void c.offsetWidth; c.classList.add('cd-flash');
    c.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (focus) c.focus({ preventScroll: true });
  }
  list.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-rel]');
    if (!a) return;
    e.preventDefault();
    var id = a.getAttribute('data-rel');
    if (history.replaceState) history.replaceState(null, '', '#t-' + id);
    showTerm(id, true);
  });
  function openFromHash() {
    var m = /^#t-([a-z0-9-]+)$/.exec(location.hash || '');
    if (m && cards[m[1]]) showTerm(m[1], false);
  }
  window.addEventListener('hashchange', openFromHash);
})();
