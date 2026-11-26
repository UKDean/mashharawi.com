/* Smart RFQ Generator: product catalogue, validation, summary, reference
   number and the exported RFQ text. No DOM and no network: the page passes
   in the form state; the same code runs in Node for the tests.

   This prepares a request for quotation. It never calculates, estimates or
   shows a price, and it never sends anything: the page only opens links
   that the user then sends from their own email or WhatsApp. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Rfq = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Al Rajhi Steel products offered in the form. Nothing is assumed: the
     user selects the type, diameter and grade; the 8 mm cold-rolled product
     is a separate category with its one diameter and grade. No 22 mm, no
     coils, no plain round bars. */
  var STD_DIAS = [10, 12, 14, 16, 18, 20, 25, 32];
  var PRODUCTS = {
    standard: { dias: STD_DIAS, grades: ['60', '80'], length: 'standard', confirm: false, fixed: false },
    epoxy:    { dias: STD_DIAS, grades: ['60', '80'], length: 'epoxy', confirm: true, fixed: false },
    cold8:    { dias: [8], grades: ['40'], length: 'cold8', confirm: false, fixed: true }
  };
  var TYPES = ['standard', 'epoxy', 'cold8'];
  var SCHEDULES = ['single', 'multiple', 'tbd'];
  var PAYMENTS = ['cash', 'lc', 'tbc'];
  var LIMITS = { lines: 50, qtyMax: 100000, short: 120, long: 1000, lineNotes: 200 };
  var CONTACT = { whatsapp: '966500590063', email: 'omar.mashharawi@rajhisteel.com' };
  // WhatsApp takes long messages, so its limit is on the text (Arabic and
  // Chinese grow about six times when encoded); email programs truncate long
  // mailto links, so that limit is on the encoded link.
  var WA_TEXT_MAX = 4000, MAIL_MAX = 1800;

  function str(v) { return v == null ? '' : String(v).trim(); }

  /* Quantity in tonnes -> integer kilograms, or an error code. Digits with a
     dot only: "12,5" is refused because it could mean 12.5 or 125. */
  function parseQty(v) {
    var s = str(v);
    if (!s) return { err: 'qtyMissing' };
    if (!/^\d+(\.\d+)?$/.test(s)) return { err: s.indexOf(',') >= 0 || /^\d+[.,]$/.test(s) ? 'qtyFormat' : (/^-/.test(s) ? 'qtyPositive' : 'qtyFormat') };
    var parts = s.split('.');
    if (parts[1] && parts[1].length > 3) return { err: 'qtyDecimals' };
    var kg = Number(parts[0]) * 1000 + Number(((parts[1] || '') + '000').slice(0, 3));
    if (!(kg > 0)) return { err: 'qtyPositive' };
    if (kg > LIMITS.qtyMax * 1000) return { err: 'qtyMax' };
    return { kg: kg };
  }
  function fmtT(kg) {             // 12500 -> "12.5", 25000 -> "25"
    var t = Math.floor(kg / 1000), r = kg % 1000;
    var whole = String(t).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return r ? whole + '.' + String(r + 1000).slice(1).replace(/0+$/, '') : whole;
  }

  function validEmail(s) { return s.length <= 254 && /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[A-Za-z]{2,}$/.test(s); }
  function validPhone(s) {
    if (!/^\+?[\d\s\-().]+$/.test(s)) return false;
    var digits = s.replace(/\D/g, '').length;
    return digits >= 7 && digits <= 15;
  }
  function validDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }

  /* validate(state, today) -> { errors: [{ path, code }], warnings: [...], lines: [...] }
     state: { customer, project, lines: [{ type, dia, grade, qty, date, notes }], payment }
     today: 'YYYY-MM-DD' (dates before it are refused). */
  function validate(state, today) {
    var errors = [], warnings = [];
    var add = function (path, code) { errors.push({ path: path, code: code }); };
    var c = state.customer || {}, p = state.project || {};
    function text(path, v, required, max) {
      var s = str(v);
      if (required && !s) add(path, 'required');
      else if (s.length > max) add(path, 'tooLong');
      return s;
    }
    text('customer.company', c.company, true, LIMITS.short);
    text('customer.contact', c.contact, true, LIMITS.short);
    var email = text('customer.email', c.email, false, 254);
    if (email && !validEmail(email)) add('customer.email', 'email');
    var phone = text('customer.phone', c.phone, true, 40);
    if (phone && !validPhone(phone)) add('customer.phone', 'phone');
    text('customer.country', c.country, false, LIMITS.short);
    text('customer.city', c.city, false, LIMITS.short);
    text('project.name', p.name, true, LIMITS.short);
    text('project.location', p.location, true, LIMITS.short);
    text('project.site', p.site, false, 300);
    text('project.notes', p.notes, false, LIMITS.long);
    var pd = str(p.date);
    if (pd && !validDate(pd)) add('project.date', 'date');
    else if (pd && today && pd < today) add('project.date', 'past');
    if (SCHEDULES.indexOf(state.project && state.project.schedule) < 0) add('project.schedule', 'schedule');
    if (PAYMENTS.indexOf(state.payment) < 0) add('payment', 'payment');

    var lines = state.lines || [];
    if (!lines.length) add('lines', 'noLines');
    if (lines.length > LIMITS.lines) add('lines', 'maxLines');
    var checked = lines.map(function (l, i) {
      var path = 'lines.' + i + '.', ok = true;
      var fail = function (f, code) { add(path + f, code); ok = false; };
      var prod = PRODUCTS[l.type];
      if (!prod) fail('type', 'type');
      var dia = str(l.dia), grade = str(l.grade);
      if (prod) {
        if (!dia) fail('dia', 'dia');
        else if (prod.dias.indexOf(Number(dia)) < 0 || !/^\d+$/.test(dia)) fail('dia', 'notOffered');
        if (!grade) fail('grade', 'gradeE');
        else if (prod.grades.indexOf(grade) < 0) fail('grade', 'notOffered');
      }
      var q = parseQty(l.qty);
      if (q.err) fail('qty', q.err);
      var d = str(l.date);
      if (d && !validDate(d)) fail('date', 'date');
      else if (d && today && d < today) fail('date', 'past');
      var notes = str(l.notes);
      if (notes.length > LIMITS.lineNotes) fail('notes', 'tooLong');
      return { n: i + 1, ok: ok, type: l.type, dia: dia ? Number(dia) : null, grade: grade, kg: q.kg || 0, date: d, notes: notes };
    });

    // the same product, diameter, grade and delivery date twice is probably a
    // mistake: warn, do not merge or remove (the user decides)
    var seen = {};
    checked.forEach(function (l) {
      if (!l.ok) return;
      var key = [l.type, l.dia, l.grade, l.date].join('|');
      if (seen[key]) warnings.push({ code: 'duplicate', lines: [seen[key], l.n] });
      else seen[key] = l.n;
      if (PRODUCTS[l.type].confirm) warnings.push({ code: 'epoxy', lines: [l.n] });
    });
    var s = summary(checked);
    if (s.validLines && s.totalKg < 30000) warnings.push({ code: 'below30' });
    return { errors: errors, warnings: warnings, lines: checked, summary: s, ok: errors.length === 0 };
  }

  /* Totals from complete lines only. The overall total is shown on its own;
     the breakdown keeps each product type, diameter and grade separate. */
  function summary(checked) {
    var valid = checked.filter(function (l) { return l.ok; });
    var groups = {};
    valid.forEach(function (l) {
      var key = l.type + '|' + l.dia + '|' + l.grade;
      (groups[key] = groups[key] || { type: l.type, dia: l.dia, grade: l.grade, kg: 0, lines: 0 });
      groups[key].kg += l.kg; groups[key].lines++;
    });
    var breakdown = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) {
      return TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || a.dia - b.dia || Number(a.grade) - Number(b.grade);
    });
    return { lines: checked.length, validLines: valid.length, incomplete: checked.length - valid.length,
             totalKg: valid.reduce(function (a, l) { return a + l.kg; }, 0), breakdown: breakdown };
  }

  /* Local reference: RFQ-YYYYMMDD-XXXXX from random bytes. Identification only. */
  var ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function makeRef(today, bytes) {
    var code = '';
    for (var i = 0; i < 5; i++) code += ALPH[bytes[i] % ALPH.length];
    return 'RFQ-' + today.replace(/-/g, '') + '-' + code;
  }

  /* The RFQ as text, in the language of the page: what is copied and what
     goes into the WhatsApp and email links. Only valid data reaches here. */
  function buildText(state, v, T, ref, today) {
    if (!v.ok) throw new Error('buildText needs a valid RFQ');
    var c = state.customer, p = state.project, L = [];
    var line = function (label, value) { if (str(value)) L.push(label + ': ' + str(value)); };
    L.push(T.title);
    L.push(T.pv.ref + ': ' + ref);
    L.push('(' + T.pv.refNote + ')');
    L.push(T.pv.date + ': ' + today);
    L.push(T.pv.to + ': Al Rajhi Steel');
    L.push('');
    L.push('[' + T.pv.customer + ']');
    line(T.f.company, c.company); line(T.f.contact, c.contact); line(T.f.phone, c.phone); line(T.f.email, c.email);
    line(T.f.city, c.city); line(T.f.country, c.country);
    L.push('');
    L.push('[' + T.pv.project + ']');
    line(T.f.project, p.name); line(T.f.location, p.location);
    L.push('');
    L.push('[' + T.pv.products + ']');
    v.lines.filter(function (l) { return l.ok; }).forEach(function (l) {
      var parts = [T.type[l.type], l.dia + ' ' + T.mm, T.grade[l.grade], T.length[l.type], fmtT(l.kg) + ' ' + T.unit];
      if (l.date) parts.push(T.f.lineDate + ' ' + l.date);
      if (PRODUCTS[l.type].confirm) parts.push(T.pv.confirm);
      L.push(l.n + '. ' + parts.join(' · ') + (l.notes ? ' (' + l.notes + ')' : ''));
    });
    L.push(T.pv.total + ': ' + fmtT(v.summary.totalKg) + ' ' + T.unit);
    if (v.summary.breakdown.length > 1) {
      L.push(T.sum.breakdown + ':');
      v.summary.breakdown.forEach(function (g) {
        L.push('- ' + T.typeShort[g.type] + ' ' + g.dia + ' ' + T.mm + ' ' + T.grade[g.grade] + ': ' + fmtT(g.kg) + ' ' + T.unit);
      });
    }
    L.push('');
    L.push('[' + T.pv.delivery + ']');
    line(T.f.site, p.site); line(T.f.date, p.date); line(T.f.schedule, T.schedule[p.schedule]);
    L.push('');
    L.push(T.pv.payment + ': ' + T.payment[state.payment]);
    if (str(p.notes)) { L.push(''); L.push('[' + T.pv.notes + ']'); L.push(str(p.notes)); }
    L.push('');
    L.push('[' + T.pv.commercial + ']');
    L.push(T.paymentNote);
    L.push(T.transportNote);
    L.push('');
    L.push(T.disclaimer);
    return L.join('\n');
  }

  function waUrl(text) {
    if (text.length > WA_TEXT_MAX) return null;
    return 'https://wa.me/' + CONTACT.whatsapp + '?text=' + encodeURIComponent(text);
  }
  function mailtoUrl(subject, body) {
    var enc = function (s) { return encodeURIComponent(s.replace(/\r?\n/g, '\r\n')); };
    var url = 'mailto:' + CONTACT.email + '?subject=' + enc(subject) + '&body=' + enc(body);
    return url.length > MAIL_MAX ? null : url;
  }
  function shortMailto(subject, note) {
    return 'mailto:' + CONTACT.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(note);
  }

  return { PRODUCTS: PRODUCTS, TYPES: TYPES, SCHEDULES: SCHEDULES, PAYMENTS: PAYMENTS, LIMITS: LIMITS, CONTACT: CONTACT, WA_TEXT_MAX: WA_TEXT_MAX, MAIL_MAX: MAIL_MAX,
           parseQty: parseQty, fmtT: fmtT, validEmail: validEmail, validPhone: validPhone, validDate: validDate,
           validate: validate, summary: summary, makeRef: makeRef, buildText: buildText,
           waUrl: waUrl, mailtoUrl: mailtoUrl, shortMailto: shortMailto };
}));
