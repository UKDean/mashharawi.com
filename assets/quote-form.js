/* mashharawi.com, quotation request form (/quote/, /ar/quote/).
   - Prefills tonnes per diameter from the calculator (?t16=4.5&t20=2 ...).
   - Attaches the visitor's first and latest utm_* (kept by quote.js).
   - Sends the request to the Google Apps Script endpoint set in quote.js.
   The page never shows prices and never sends anything to the customer:
   Omar gets a Telegram alert and the official quotation comes from
   Al Rajhi Steel. Load after quote.js. */
(function () {
  'use strict';
  var form = document.getElementById('rfq');
  if (!form) return;
  var AR = document.documentElement.getAttribute('dir') === 'rtl';
  var DIAMETERS = [10, 12, 14, 16, 18, 20, 25, 32];
  var started = Date.now();
  var T = AR ? {
    total: 'الإجمالي', t: 'طن',
    need: 'أكمل الحقول المطلوبة المعلَّمة.', qty: 'أدخل كمية قطر واحد على الأقل.',
    phone: 'أدخل رقم جوال صحيحاً، مثل 05xxxxxxxx.', consent: 'وافق على التواصل معك بخصوص هذا الطلب.',
    sending: 'جارٍ الإرسال…', ok: 'وصل طلبك. رقم المرجع: ', ok2: 'سأراجعه وأتواصل معك، وعرض السعر الرسمي يصدر من الراجحي للحديد.',
    offline: 'لم يُرسل الطلب من الموقع. انسخ الملخص وأرسله على واتساب أو البريد:', copied: 'تم النسخ', copy: 'انسخ الملخص'
  } : {
    total: 'Total', t: 't',
    need: 'Please complete the required fields.', qty: 'Enter a quantity for at least one diameter.',
    phone: 'Enter a valid mobile number, e.g. 05xxxxxxxx or +9665xxxxxxxx.', consent: 'Please agree to be contacted about this request.',
    sending: 'Sending…', ok: 'Request received. Reference: ', ok2: 'I will review it and contact you. The official quotation is issued by Al Rajhi Steel.',
    offline: 'The request could not be sent from the site. Copy the summary and send it on WhatsApp or by email:', copied: 'Copied', copy: 'Copy summary'
  };

  function $(id) { return document.getElementById(id); }
  function n(v) { var x = parseFloat(String(v || '').replace(',', '.')); return isFinite(x) && x > 0 ? Math.round(x * 1000) / 1000 : 0; }

  // Prefill from the calculator.
  var q = new URLSearchParams(location.search);
  DIAMETERS.forEach(function (d) {
    var v = n(q.get('t' + d)), el = $('t' + d);
    if (el && v) el.value = v;
  });
  if (q.get('from') === 'calculator' && $('rfqFromCalc')) $('rfqFromCalc').hidden = false;

  function totals() {
    var sum = 0;
    DIAMETERS.forEach(function (d) { sum += n(($('t' + d) || {}).value); });
    sum = Math.round(sum * 1000) / 1000;
    if ($('rfqTotal')) $('rfqTotal').textContent = sum.toLocaleString('en-US', { maximumFractionDigits: 3 });
    return sum;
  }
  form.addEventListener('input', totals);
  totals();

  function normPhone(p) {
    p = String(p || '').replace(/[\s\-()]/g, '').replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 1632); });
    if (/^05\d{8}$/.test(p)) return '+966' + p.slice(1);
    if (/^5\d{8}$/.test(p)) return '+966' + p;
    if (/^(\+|00)\d{8,15}$/.test(p)) return p.replace(/^00/, '+');
    return '';
  }

  function collect() {
    var attr = (window.MASH_ATTR ? window.MASH_ATTR() : {}) || {};
    var first = attr.first || {}, last = attr.last || {};
    var tonnes = {};
    DIAMETERS.forEach(function (d) { var v = n(($('t' + d) || {}).value); if (v) tonnes['d' + d] = v; });
    function v(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
    function c(id) { var e = $(id); return !!(e && e.checked); }
    return {
      kind: 'lead', lang: AR ? 'ar' : 'en', page: location.pathname,
      name: v('fName'), company: v('fCompany'), position: v('fPosition'),
      phone: normPhone(v('fPhone')), phone_raw: v('fPhone'), email: v('fEmail'),
      project: v('fProject'), city: v('fCity'), tonnes: tonnes, total_t: totals(),
      grade: v('fGrade'), cutting: c('fCut'), epoxy: c('fEpoxy'),
      needed_by: v('fDate'), stage: v('fStage'), notes: v('fNotes').slice(0, 1500),
      consent: c('fConsent'), from_calculator: q.get('from') === 'calculator',
      utm_source: last.utm_source || '', utm_medium: last.utm_medium || '', utm_campaign: last.utm_campaign || '',
      utm_content: last.utm_content || '', first_utm_source: first.utm_source || '', first_utm_campaign: first.utm_campaign || '',
      first_utm_content: first.utm_content || '', first_landing: first.landing || '', referrer: last.referrer || first.referrer || '',
      website: v('fWebsite'), // honeypot: real people leave it empty
      elapsed_ms: Date.now() - started
    };
  }
  window.MASH_COLLECT = collect;

  function summary(d) {
    var L = [AR ? 'طلب عرض سعر حديد تسليح – الراجحي للحديد' : 'Rebar quotation request – Al Rajhi Steel'];
    L.push((AR ? 'الاسم: ' : 'Name: ') + d.name + ' · ' + d.company + (d.position ? ' · ' + d.position : ''));
    L.push((AR ? 'الجوال: ' : 'Mobile: ') + (d.phone || d.phone_raw) + (d.email ? ' · ' + d.email : ''));
    L.push((AR ? 'المشروع: ' : 'Project: ') + (d.project || '-') + ' · ' + d.city);
    L.push(Object.keys(d.tonnes).map(function (k) { return k.slice(1) + (AR ? 'مم ' : 'mm ') + d.tonnes[k] + T.t; }).join(' · ') + ' (' + T.total + ' ' + d.total_t + ' ' + T.t + ')');
    L.push('Grade ' + d.grade + (d.cutting ? (AR ? ' · قص' : ' · cutting') : '') + (d.epoxy ? (AR ? ' · إيبوكسي' : ' · epoxy') : ''));
    if (d.needed_by) L.push((AR ? 'مطلوب بتاريخ: ' : 'Needed by: ') + d.needed_by);
    if (d.notes) L.push(d.notes);
    return L.join('\n');
  }

  function say(msg, kind) {
    var box = $('rfqMsg');
    box.className = 'rfq-msg' + (kind ? ' is-' + kind : '');
    box.textContent = msg;
    box.hidden = false;
    box.focus();
  }

  function fallback(d) {
    say(T.offline, 'warn');
    var pre = $('rfqSummary'); pre.textContent = summary(d); pre.hidden = false;
    var cb = $('rfqCopy'); cb.hidden = false;
    cb.onclick = function () {
      try { navigator.clipboard.writeText(pre.textContent).then(function () { cb.textContent = T.copied; }); } catch (e) {}
    };
    $('rfqAlt').hidden = false;
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var d = collect();
    if (!d.name || !d.company || !d.city || !d.grade || !d.stage) return say(T.need, 'err');
    if (!d.phone) return say(T.phone, 'err');
    if (!d.total_t) return say(T.qty, 'err');
    if (!d.consent) return say(T.consent, 'err');
    if (d.website) return say(T.ok + '—', 'ok'); // bot: pretend success, send nothing

    var url = window.MASH_LEAD_ENDPOINT || '';
    if (!url) return fallback(d);
    var btn = $('rfqSend'); btn.disabled = true; var label = btn.textContent; btn.textContent = T.sending;
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(d) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error(res && res.error || 'rejected');
        form.reset(); totals();
        say(T.ok + res.ref + '. ' + T.ok2, 'ok');
      })
      .catch(function () { fallback(d); })
      .then(function () { btn.disabled = false; btn.textContent = label; });
  });
})();
