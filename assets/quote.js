/* mashharawi.com, rebar quotation shortcuts and lead attribution.
   1. A floating WhatsApp button on the pages that include this file. It opens
      Omar's WhatsApp Business link; his number is not published.
   2. On the rebar weight calculator: a button that copies the order and opens
      WhatsApp (unchanged), and a button that opens the quotation request form
      with the diameters and tonnes already filled in.
   3. Attribution: the first and the latest utm_source / utm_campaign /
      utm_content a visitor arrived with are kept in this browser, so a
      quotation request sent later from /quote/ says which post brought it.
   4. WhatsApp clicks are counted: when a wa.me link is clicked, one small
      event is sent to the lead endpoint. The links themselves are not changed.
   Nothing is sent while LEAD_ENDPOINT is empty. Quotations are never priced
   here: every official quotation is issued by Al Rajhi Steel. */
(function () {
  'use strict';
  var AR = document.documentElement.getAttribute('dir') === 'rtl';
  var ZH = /^zh/i.test(document.documentElement.getAttribute('lang') || '');
  var LINK = 'https://wa.me/message/D6ABM7QFWVSPB1';

  // Google Apps Script web app URL (ends in /exec). Not a secret: it only
  // accepts quotation requests and click events. Empty = send nothing.
  var LEAD_ENDPOINT = '';
  window.MASH_LEAD_ENDPOINT = LEAD_ENDPOINT;

  var DIAMETERS = [10, 12, 14, 16, 18, 20, 25, 32];
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var STORE = 'mash_attr_v1';

  /* ---------- attribution ---------- */
  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null') || {}; } catch (e) { return {}; }
  }
  function writeStore(o) {
    try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) { /* storage off: attribution is best effort */ }
  }
  function captureAttribution() {
    var q = new URLSearchParams(location.search), hit = {}, any = false;
    UTM_KEYS.forEach(function (k) {
      var v = (q.get(k) || '').trim().slice(0, 120);
      if (v) { hit[k] = v; any = true; }
    });
    var ref = '';
    try { ref = document.referrer && new URL(document.referrer).host !== location.host ? document.referrer.slice(0, 200) : ''; } catch (e) {}
    var st = readStore(), now = new Date().toISOString();
    if (any || ref) {
      var touch = { at: now, landing: location.pathname, referrer: ref };
      UTM_KEYS.forEach(function (k) { touch[k] = hit[k] || ''; });
      if (!st.first) st.first = touch;
      if (any || !st.last) st.last = touch;
    }
    if (!st.first) st.first = { at: now, landing: location.pathname, referrer: '' };
    writeStore(st);
    return st;
  }
  var ATTR = captureAttribution();
  window.MASH_ATTR = function () { return readStore(); };

  /* ---------- events (WhatsApp clicks) ---------- */
  function sendEvent(type, extra) {
    if (!LEAD_ENDPOINT) return false;
    var st = readStore(), last = st.last || {}, first = st.first || {};
    var body = {
      kind: 'event', type: type, page: location.pathname, lang: AR ? 'ar' : (ZH ? 'zh' : 'en'),
      utm_source: last.utm_source || '', utm_medium: last.utm_medium || '', utm_campaign: last.utm_campaign || '',
      utm_content: last.utm_content || '', first_landing: first.landing || '', referrer: last.referrer || first.referrer || ''
    };
    for (var k in (extra || {})) body[k] = extra[k];
    var data = JSON.stringify(body);
    try {
      if (navigator.sendBeacon) return navigator.sendBeacon(LEAD_ENDPOINT, new Blob([data], { type: 'text/plain' }));
      fetch(LEAD_ENDPOINT, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: data });
      return true;
    } catch (e) { return false; }
  }
  window.MASH_SEND_EVENT = sendEvent;

  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href*="wa.me/"]') : null;
    if (!a) return;
    var where = a.classList.contains('q-fab') ? 'floating' : (a.closest('header, nav') ? 'nav' : 'link');
    sendEvent('wa_click', { where: where });
  }, true);

  /* ---------- floating WhatsApp button ---------- */
  if (!document.querySelector('.q-fab') && !document.body.hasAttribute('data-no-fab')) {
    var a = document.createElement('a');
    a.className = 'q-fab';
    a.target = '_blank';
    a.rel = 'noopener';
    a.href = LINK;
    a.textContent = AR ? 'اطلب عرض سعر · واتساب' : (ZH ? '钢筋询价 · WhatsApp' : 'Rebar quote · WhatsApp');
    document.body.appendChild(a);
  }

  /* ---------- rebar weight calculator ---------- */
  var head = document.querySelector('#calc .calc-order-head');
  if (!head) return;

  function txt(id) { var e = document.getElementById(id); return e ? e.textContent.trim() : ''; }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function num(s) { var n = parseFloat(String(s).replace(/[^\d.]/g, '')); return isFinite(n) ? n : 0; }

  // Tonnes per diameter from the calculator: the order table if it has rows,
  // otherwise the single line on screen. Diameters outside the sales range are
  // left out of the form (the copy-to-WhatsApp text still carries them).
  function tonnesByDiameter() {
    var out = {}, rows = document.querySelectorAll('#cRows tr');
    function add(d, t) {
      d = Math.round(num(d)); t = num(t);
      if (DIAMETERS.indexOf(d) < 0 || !(t > 0)) return;
      out[d] = Math.round(((out[d] || 0) + t) * 1000) / 1000;
    }
    if (rows.length) {
      [].forEach.call(rows, function (r) {
        var c = [].map.call(r.querySelectorAll('td'), function (x) { return x.textContent.trim(); });
        add(c[0], c[4]);
      });
    } else {
      add(txt('cDiaVal'), txt('oTot'));
    }
    return out;
  }
  window.MASH_TONNES = tonnesByDiameter;

  function orderText() {
    var lines = [AR ? 'السلام عليكم أستاذ عمر، أحتاج عرض سعر لهذا الطلب:' : 'Hello Omar, please quote this rebar order:'];
    var rows = document.querySelectorAll('#cRows tr');
    if (!rows.length) {
      var d = txt('cDiaVal'), l = val('cLen') || '12', q = val('cQty'), t = txt('oTot');
      lines.push(AR ? ('قطر ' + d + ' مم · طول ' + l + ' م · ' + q + ' سيخ · ' + t + ' طن')
                    : ('Ø' + d + ' mm · ' + l + ' m · ' + q + ' bars · ' + t + ' t'));
    } else {
      rows.forEach(function (r) {
        var c = [].map.call(r.querySelectorAll('td'), function (x) { return x.textContent.trim(); });
        lines.push(AR ? ('قطر ' + c[0] + ' مم · طول ' + c[1] + ' م · ' + c[2] + ' سيخ · ' + c[4] + ' طن')
                      : ('Ø' + c[0] + ' mm · ' + c[1] + ' m · ' + c[2] + ' bars · ' + c[4] + ' t'));
      });
      lines.push((AR ? 'الإجمالي: ' : 'Total: ') + txt('tT') + (AR ? ' طن' : ' t'));
    }
    lines.push(AR ? 'الدرجة (Grade 60 / 80): ' : 'Grade (60 / 80): ');
    lines.push(AR ? 'قص حسب الطلب أو إيبوكسي؟ ' : 'Cutting or epoxy coating? ');
    lines.push(AR ? 'مدينة المشروع: ' : 'Project city: ');
    lines.push(AR ? 'الشركة: ' : 'Company: ');
    return lines.join('\n');
  }

  // Button 1: official quotation request form, prefilled.
  var f = document.createElement('a');
  f.className = 'calc-btn ok';
  f.id = 'cRfq';
  f.href = AR ? '/ar/quote/' : '/quote/';
  var F_LABEL = AR ? 'اطلب عرض سعر رسمي بهذه الكميات' : 'Request an official quotation for this order';
  f.textContent = F_LABEL;
  f.addEventListener('click', function (ev) {
    var t = tonnesByDiameter(), q = new URLSearchParams();
    Object.keys(t).forEach(function (d) { q.set('t' + d, String(t[d])); });
    q.set('from', 'calculator');
    ev.preventDefault();
    location.href = f.getAttribute('href') + '?' + q.toString();
  });
  head.appendChild(f);

  // Button 2: copy the order and open WhatsApp (as before).
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'calc-btn ghost';
  b.id = 'cQuote';
  var LABEL = AR ? 'انسخ الطلب وأرسله على واتساب' : 'Copy order & open WhatsApp';
  b.textContent = LABEL;
  head.appendChild(b);

  b.addEventListener('click', function () {
    var text = orderText();
    var done = function (ok) {
      b.textContent = ok ? (AR ? 'تم نسخ الطلب، الصقه في المحادثة' : 'Order copied, paste it in the chat')
                         : (AR ? 'افتح واتساب واكتب الطلب' : 'Open WhatsApp and type the order');
      setTimeout(function () { b.textContent = LABEL; }, 6000);
    };
    try {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } catch (e) { done(false); }
    sendEvent('wa_click', { where: 'calculator' });
    window.open(LINK, '_blank', 'noopener');
  });
})();
