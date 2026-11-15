/**
 * mashharawi.com lead intake: Google Apps Script web app, bound to one sheet.
 *
 * Receives quotation requests and WhatsApp-click events from mashharawi.com,
 * stores them in THIS spreadsheet, scores each request A/B/C, and alerts Omar
 * on Telegram. It never prices anything and never contacts the customer:
 * every official quotation is issued by Al Rajhi Steel through its own process.
 *
 * What the public can do with the web app URL:
 *   POST a lead or a wa_click event (write-only; the answer is ok + a random
 *   reference, never sheet data). GET returns a health check. Reading leads
 *   needs ?action=export&key=<EXPORT_KEY>, and EXPORT_KEY must be set and at
 *   least 32 characters, otherwise export is off.
 *
 * Settings live in Script Properties (Project Settings > Script properties),
 * never in this file or in the repository:
 *   TELEGRAM_BOT_TOKEN   bot token from BotFather
 *   TELEGRAM_CHAT_ID     Omar's chat id with the bot
 *   NOTIFY_EMAIL         optional backup copy of each alert by email
 *   EXPORT_KEY           optional, 32+ random characters; enables export
 *   TEST_MODE            "true" (default): everything goes to the *_TEST
 *                        sheets, never mixed with real leads. Set "false"
 *                        only once the company approves where customer data
 *                        may be stored.
 */

var TZ = 'Asia/Riyadh';
var DIAMETERS = [10, 12, 14, 16, 18, 20, 25, 32];
var MAX_BODY = 20000;              // bytes; a real request is ~1-2 KB
var MIN_EXPORT_KEY = 32;
var LIMITS = {
  perPhone: [3, 600],              // 3 requests per phone per 10 minutes
  alertsPerHour: 30,               // Telegram alerts per hour; leads beyond are still stored
  eventsPerHour: 300,              // WhatsApp-click events stored per hour
  leadsPerHour: 200                // hard ceiling of stored leads per hour (abuse)
};

// Column keys (code) and the header shown in the sheet (Arabic for Omar).
var LEAD_COLS = [
  ['id', 'المرجع'], ['received', 'وقت الاستلام'], ['test', 'تجريبي'], ['class', 'الفئة'], ['score', 'النقاط'],
  ['name', 'الاسم'], ['company', 'الشركة'], ['position', 'المنصب'], ['phone', 'الجوال'], ['email', 'البريد'],
  ['project', 'المشروع'], ['city', 'مدينة التسليم'], ['total_t', 'الإجمالي (طن)'],
  ['d10', 'Ø10'], ['d12', 'Ø12'], ['d14', 'Ø14'], ['d16', 'Ø16'], ['d18', 'Ø18'], ['d20', 'Ø20'], ['d25', 'Ø25'], ['d32', 'Ø32'],
  ['grade', 'الدرجة'], ['cutting', 'قص'], ['epoxy', 'إيبوكسي'], ['needed_by', 'مطلوب بتاريخ'], ['stage', 'مرحلة الشراء'],
  ['notes', 'ملاحظات العميل'], ['from_calculator', 'من الحاسبة'],
  ['utm_source', 'utm_source'], ['utm_medium', 'utm_medium'], ['utm_campaign', 'utm_campaign'], ['utm_content', 'utm_content (المنشور)'],
  ['first_utm_source', 'أول مصدر'], ['first_utm_campaign', 'أول حملة'], ['first_utm_content', 'أول منشور'],
  ['first_landing', 'أول صفحة'], ['referrer', 'المُحيل'], ['page', 'صفحة الإرسال'], ['lang', 'اللغة'],
  ['telegram', 'حالة الإشعار'], ['sid', 'معرّف الإرسال'],
  // Filled in by Omar:
  ['status', 'الحالة'], ['ownership', 'الملكية'], ['next_follow_up', 'المتابعة القادمة'], ['last_contact', 'آخر تواصل'],
  ['company_quote_no', 'رقم عرض السعر (الشركة)'], ['quote_date', 'تاريخ عرض السعر'], ['outcome', 'النتيجة'],
  ['tons_won', 'الأطنان المباعة'], ['lost_reason', 'سبب الخسارة'], ['comments', 'ملاحظات عمر']
];
var EVENT_COLS = [
  ['time', 'الوقت'], ['type', 'النوع'], ['where', 'المكان'], ['page', 'الصفحة'], ['lang', 'اللغة'],
  ['utm_source', 'utm_source'], ['utm_campaign', 'utm_campaign'], ['utm_content', 'utm_content'],
  ['first_landing', 'أول صفحة'], ['referrer', 'المُحيل']
];
var AUDIT_COLS = [['time', 'الوقت'], ['action', 'العملية'], ['detail', 'التفاصيل']];
// Same stages as the Sales Hub (مركز مبيعات مشهراوي), so a lead keeps its stage when it moves there.
var STATUS = ['مستهدف', 'جديد', 'تم التواصل', 'اجتماع', 'طلب عرض سعر', 'عرض مرسل', 'تفاوض', 'فاز', 'خسر', 'بارد'];
var CLOSED = ['فاز', 'خسر', 'بارد'];
var QUOTED = ['عرض مرسل', 'تفاوض', 'فاز', 'خسر'];
var OWNERSHIP = ['لم يُفحص', 'متاح', 'عميل جديد', 'لدى زميل'];
var OUTCOME = ['', 'فاز', 'خسر', 'مؤجل'];
var STAGES = { ready: 'جاهز للطلب خلال 30 يوماً', comparing: 'يقارن عروض الأسعار', budget: 'ميزانية أو تصميم' };
var GRADES = { '60': 'Grade 60', '80': 'Grade 80', both: 'Grade 60 و80', unsure: 'لم تُحدد' };

function idx_(cols, key) {
  for (var i = 0; i < cols.length; i++) if (cols[i][0] === key) return i;
  throw new Error('no column ' + key);
}

/* ---------------- web app ---------------- */

function doGet(e) {
  var q = (e && e.parameter) || {};
  if (q.action === 'export') {
    var key = String(props_().getProperty('EXPORT_KEY') || '');
    if (key.length < MIN_EXPORT_KEY || !safeEqual_(String(q.key || ''), key)) {
      audit_('export-denied', '');
      return json_({ ok: false, error: 'forbidden' });
    }
    var leads = exportForHub_(String(q.since || ''), q.include_test === '1');
    audit_('export', leads.length + ' customers' + (q.since ? ' since ' + q.since : ''));
    return json_({ ok: true, leads: leads });
  }
  return json_({ ok: true, service: 'mashharawi-leads' });
}

function doPost(e) {
  var raw = (e && e.postData && e.postData.contents) || '';
  if (raw.length > MAX_BODY) return json_({ ok: false, error: 'too_large' });
  var body;
  try { body = JSON.parse(raw || '{}'); } catch (x) { return json_({ ok: false, error: 'bad_request' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json_({ ok: false, error: 'bad_request' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return json_({ ok: false, error: 'busy' });   // the page then offers the copy/WhatsApp/email fallback
  try {
    if (body.kind === 'event') return json_(logEvent_(body));
    if (body.kind === 'lead') return json_(handleLead_(body));
    return json_({ ok: false, error: 'unknown_kind' });
  } catch (err) {
    console.error('doPost', err);
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- helpers ---------------- */

function props_() { return PropertiesService.getScriptProperties(); }
function isTest_() { return String(props_().getProperty('TEST_MODE') || 'true').toLowerCase() !== 'false'; }
function name_(base, test) { return (test === undefined ? isTest_() : test) ? base + '_TEST' : base; }

// The spreadsheet this script is bound to. No other file is ever opened
// (manifest scope: spreadsheets.currentonly).
function book_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name, cols) {
  var ss = book_(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(cols.map(function (c) { return c[1]; }));
    sh.setFrozenRows(1);
  }
  return sh;
}

// Text as the customer typed it: control characters removed, trimmed, capped.
function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max || 200);
}

// Safe for a sheet cell: text starting with = + - @ would run as a formula,
// so it is stored as plain text (a leading ' is not shown by Sheets).
function cell_(v) {
  return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function day_(offsetDays) {
  return Utilities.formatDate(new Date(Date.now() + (offsetDays || 0) * 864e5), TZ, 'yyyy-MM-dd');
}

// Fixed-window counter: the window starts with the first hit and is not
// extended by later hits.
function hit_(key, limit, seconds) {
  var cache = CacheService.getScriptCache(), now = Date.now();
  var w = null;
  try { w = JSON.parse(cache.get(key) || 'null'); } catch (x) {}
  if (!w || now - w.t >= seconds * 1000) w = { t: now, n: 0 };
  if (w.n >= limit) return false;
  w.n++;
  cache.put(key, JSON.stringify(w), Math.max(1, Math.ceil((w.t + seconds * 1000 - now) / 1000)));
  return true;
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Random, so a reference reveals nothing about how many leads exist.
function randomRef_() {
  var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
  for (var i = 0; i < 6; i++) s += a.charAt(Math.floor(Math.random() * a.length));
  return 'L-' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-' + s;
}

function normPhone_(p) {
  var d = String(p || '').replace(/[^\d+]/g, '').replace(/^00/, '+');
  if (/^05\d{8}$/.test(d)) return '+966' + d.slice(1);
  if (/^5\d{8}$/.test(d)) return '+966' + d;
  if (/^9665\d{8}$/.test(d)) return '+' + d;
  return /^\+\d{8,15}$/.test(d) ? d : '';
}

function audit_(action, detail) {
  try { sheet_('Audit', AUDIT_COLS).appendRow([now_(), action, clean_(detail, 200)].map(cell_)); } catch (x) {}
}

/* ---------------- scoring (see the strategy doc, section 6) ---------------- */

function score_(lead) {
  var p = 0, t = Number(lead.total_t) || 0;
  p += t >= 200 ? 25 : t >= 50 ? 15 : t > 0 ? 5 : 0;
  p += lead.stage === 'ready' ? 25 : lead.stage === 'comparing' ? 15 : lead.stage === 'budget' ? 5 : 0;
  var specs = Object.keys(lead.tonnes || {}).length > 0 && (lead.grade === '60' || lead.grade === '80' || lead.grade === 'both');
  p += specs ? 15 : 7;
  var days = 9999;
  if (lead.needed_by && /^\d{4}-\d{2}-\d{2}$/.test(lead.needed_by)) {
    days = (Date.parse(lead.needed_by) - Date.parse(day_(0))) / 864e5;
  }
  p += days <= 30 ? 15 : days <= 90 ? 10 : 3;
  var role = /(procure|purchas|buyer|commercial|manager|director|owner|ceo|gm|مشتري|مشتريات|توريد|مدير|تجاري|رئيس|مالك|采购|经理|总)/i;
  p += role.test(lead.position || '') ? 10 : 4;
  p += lead.city ? 10 : 0;
  var cls = p >= 70 ? 'A' : p >= 40 ? 'B' : 'C';
  return { points: p, cls: cls };
}

function nextAction_(cls) {
  return cls === 'A' ? 'افحص الملكية في نظام الشركة ثم اتصل اليوم'
       : cls === 'B' ? 'رد خلال 24 ساعة واستكمل البيانات الناقصة'
       : 'رسالة شكر ومتابعة شهرية (منك يدوياً)';
}

/* ---------------- leads ---------------- */

function validate_(b) {
  if (b.website) return 'honeypot';
  if (Number(b.elapsed_ms) > 0 && Number(b.elapsed_ms) < 3000) return 'too_fast';
  if (b.consent !== true) return 'no_consent';
  if (!clean_(b.name) || !clean_(b.company) || !clean_(b.city) || !GRADES[b.grade] || !STAGES[b.stage]) return 'missing';
  if (!normPhone_(b.phone)) return 'phone';
  var t = b.tonnes, any = false;
  if (!t || typeof t !== 'object' || Array.isArray(t)) return 'quantity';
  for (var k in t) {
    var d = Number(String(k).replace(/^d/, ''));
    if (DIAMETERS.indexOf(d) < 0) return 'diameter';
    var v = Number(t[k]);
    if (!(v > 0 && v <= 100000)) return 'quantity';
    any = true;
  }
  if (!any) return 'quantity';
  return '';
}

function handleLead_(b) {
  var err = validate_(b);
  if (err === 'honeypot') return { ok: true, ref: randomRef_() };     // bots get a quiet "ok", nothing stored
  if (err) return { ok: false, error: err };

  var phone = normPhone_(b.phone), test = isTest_();
  var cache = CacheService.getScriptCache();
  // Same submission sent twice (network retry, double click): return the first reference.
  var sid = clean_(b.sid, 40);
  if (sid) { var seen = cache.get('sid:' + sid); if (seen) return { ok: true, ref: seen, duplicate: true }; }
  if (!hit_('ph:' + phone, LIMITS.perPhone[0], LIMITS.perPhone[1])) return { ok: false, error: 'rate' };
  if (!hit_('leads', LIMITS.leadsPerHour, 3600)) { audit_('lead-ceiling', phone.slice(0, 7) + '…'); return { ok: false, error: 'rate' }; }

  var tonnes = {}, total = 0;
  DIAMETERS.forEach(function (d) {
    var v = Math.round((Number(b.tonnes['d' + d]) || 0) * 1000) / 1000;
    if (v > 0) { tonnes['d' + d] = v; total += v; }
  });
  total = Math.round(total * 1000) / 1000;
  var lead = {
    name: clean_(b.name, 120), company: clean_(b.company, 160), position: clean_(b.position, 120),
    phone: phone, email: clean_(b.email, 160), project: clean_(b.project, 160), city: clean_(b.city, 80),
    tonnes: tonnes, total_t: total, grade: b.grade, cutting: b.cutting === true, epoxy: b.epoxy === true,
    needed_by: /^\d{4}-\d{2}-\d{2}$/.test(String(b.needed_by || '')) ? b.needed_by : '',
    stage: b.stage, notes: clean_(b.notes, 1500), from_calculator: b.from_calculator === true,
    utm_source: clean_(b.utm_source, 120), utm_medium: clean_(b.utm_medium, 120), utm_campaign: clean_(b.utm_campaign, 120),
    utm_content: clean_(b.utm_content, 120), first_utm_source: clean_(b.first_utm_source, 120),
    first_utm_campaign: clean_(b.first_utm_campaign, 120), first_utm_content: clean_(b.first_utm_content, 120),
    first_landing: clean_(b.first_landing, 200), referrer: clean_(b.referrer, 200), page: clean_(b.page, 200), lang: clean_(b.lang, 5)
  };
  var s = score_(lead), id = randomRef_();
  var follow = s.cls === 'A' ? day_(0) : s.cls === 'B' ? day_(1) : day_(7);

  var row = LEAD_COLS.map(function () { return ''; });
  function set(k, v) { row[idx_(LEAD_COLS, k)] = v; }
  set('id', id); set('received', now_()); set('test', test ? 'TEST' : ''); set('class', s.cls); set('score', s.points);
  ['name', 'company', 'position', 'phone', 'email', 'project', 'city', 'total_t', 'needed_by', 'notes',
   'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'first_utm_source', 'first_utm_campaign', 'first_utm_content',
   'first_landing', 'referrer', 'page', 'lang'].forEach(function (k) { set(k, lead[k]); });
  DIAMETERS.forEach(function (d) { set('d' + d, tonnes['d' + d] || ''); });
  set('grade', GRADES[lead.grade]); set('cutting', lead.cutting ? 'نعم' : ''); set('epoxy', lead.epoxy ? 'نعم' : '');
  set('stage', STAGES[lead.stage]); set('from_calculator', lead.from_calculator ? 'نعم' : '');
  set('status', 'طلب عرض سعر'); set('ownership', 'لم يُفحص'); set('next_follow_up', follow); set('sid', sid);
  set('telegram', 'pending');

  // 1. Save first. Everything after this point may fail without losing the lead.
  var sh = sheet_(name_('Leads', test), LEAD_COLS);
  sh.appendRow(row.map(cell_));
  var rowNo = sh.getLastRow();
  if (sid) cache.put('sid:' + sid, id, 21600);

  // 2. Alert (rate-capped). A failure is written on the row, not thrown.
  var status;
  if (hit_('alerts', LIMITS.alertsPerHour, 3600)) {
    status = notify_(leadMessage_(id, lead, s, test));
  } else {
    status = 'held-alert-cap';
    if (hit_('cap-notice', 1, 3600)) notify_((test ? '[TEST] ' : '') + 'تنبيه: وصل حد التنبيهات لهذه الساعة. الطلبات تُحفظ في الجدول؛ راجعه.');
  }
  try { sh.getRange(rowNo, idx_(LEAD_COLS, 'telegram') + 1).setValue(status); } catch (x) { console.error('status write', x); }
  return { ok: true, ref: id };
}

function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function leadMessage_(id, lead, s, test) {
  var q = DIAMETERS.filter(function (d) { return lead.tonnes['d' + d]; })
    .map(function (d) { return 'Ø' + d + ': ' + lead.tonnes['d' + d] + ' ط'; }).join(' · ');
  var src = lead.utm_source || lead.utm_content
    ? (lead.utm_source || '-') + ' / ' + (lead.utm_content || '-') + (lead.utm_campaign ? ' (حملة: ' + lead.utm_campaign + ')' : '')
    : 'بدون وسم (مباشر أو بحث)';
  var wa = lead.phone ? 'https://wa.me/' + lead.phone.replace(/^\+/, '') : '';
  var L = [];
  L.push((test ? '[TEST] ' : '') + '<b>طلب عرض سعر جديد — ' + s.cls + ' (' + s.points + '/100)</b>');
  L.push('المرجع: ' + esc_(id));
  L.push('الاسم: ' + esc_(lead.name) + ' | ' + esc_(lead.company) + (lead.position ? ' | ' + esc_(lead.position) : ''));
  L.push('الجوال: ' + esc_(lead.phone) + (lead.email ? ' | ' + esc_(lead.email) : ''));
  L.push('المشروع: ' + esc_(lead.project || '-') + ' | التسليم: ' + esc_(lead.city));
  L.push('الكميات: ' + esc_(q) + ' — الإجمالي ' + lead.total_t + ' طن');
  L.push('الدرجة: ' + esc_(GRADES[lead.grade] || lead.grade) + (lead.cutting ? ' · قص' : '') + (lead.epoxy ? ' · إيبوكسي' : ''));
  L.push('المرحلة: ' + esc_(STAGES[lead.stage] || '-') + (lead.needed_by ? ' | مطلوب بتاريخ ' + esc_(lead.needed_by) : ''));
  L.push('المصدر: ' + esc_(src));
  if (lead.first_landing) L.push('أول صفحة: ' + esc_(lead.first_landing) + (lead.from_calculator ? ' · عبر الحاسبة' : ''));
  if (lead.notes) L.push('ملاحظات: ' + esc_(lead.notes.slice(0, 300)));
  L.push('');
  L.push('<b>الإجراء:</b> ' + nextAction_(s.cls));
  if (wa) L.push('واتساب: ' + wa);
  L.push('<i>لم يُرسل للعميل أي شيء تلقائياً. عرض السعر الرسمي من الراجحي للحديد.</i>');
  return L.join('\n');
}

// Telegram to Omar only (and an optional email copy). Returns a status word
// for the sheet; never throws.
function notify_(html) {
  var p = props_(), token = p.getProperty('TELEGRAM_BOT_TOKEN'), chat = p.getProperty('TELEGRAM_CHAT_ID');
  var status = 'no-telegram-config';
  if (token && chat) {
    try {
      var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ chat_id: chat, text: html, parse_mode: 'HTML', disable_web_page_preview: true })
      });
      status = r.getResponseCode() === 200 ? 'sent' : 'telegram-error-' + r.getResponseCode();
    } catch (e) {
      status = 'telegram-exception';
    }
  }
  var mail = p.getProperty('NOTIFY_EMAIL');
  if (mail) {
    try {
      MailApp.sendEmail({ to: mail, subject: 'طلب عرض سعر جديد', htmlBody: html.replace(/\n/g, '<br>') });
      status += '+email';
    } catch (e) { status += '+email-error'; }
  }
  return status;
}

// Re-send alerts for leads whose alert failed or was held (run by hand or by
// the daily trigger). The leads are already safe in the sheet.
function retryAlerts() {
  var test = isTest_(), sh = book_().getSheetByName(name_('Leads', test));
  if (!sh || sh.getLastRow() < 2) return 0;
  var v = sh.getDataRange().getValues(), ci = idx_(LEAD_COLS, 'telegram'), n = 0;
  for (var r = 1; r < v.length; r++) {
    var st = String(v[r][ci] || '');
    if (st === 'sent' || st.indexOf('sent+') === 0) continue;
    var o = {}; LEAD_COLS.forEach(function (c, i) { o[c[0]] = v[r][i]; });
    var msg = (test ? '[TEST] ' : '') + '<b>(إعادة إرسال) طلب ' + esc_(o.id) + ' — ' + esc_(o['class']) + '</b>\n' +
              esc_(o.name) + ' | ' + esc_(o.company) + ' | ' + esc_(String(o.phone).replace(/^'/, '')) + '\n' + esc_(o.total_t) + ' طن · ' + esc_(o.city);
    var res = notify_(msg);
    sh.getRange(r + 1, ci + 1).setValue(res);
    if (res.indexOf('sent') === 0) n++;
  }
  return n;
}

/* ---------------- events ---------------- */

function logEvent_(b) {
  var type = clean_(b.type, 40);
  if (type !== 'wa_click') return { ok: false, error: 'event_type' };
  if (!hit_('ev', LIMITS.eventsPerHour, 3600)) return { ok: false, error: 'rate' };
  var sh = sheet_(name_('Events'), EVENT_COLS);
  var row = EVENT_COLS.map(function () { return ''; });
  function set(k, v) { row[idx_(EVENT_COLS, k)] = v; }
  set('time', now_()); set('type', type); set('where', clean_(b.where, 40)); set('page', clean_(b.page, 200));
  set('lang', clean_(b.lang, 5)); set('utm_source', clean_(b.utm_source, 120)); set('utm_campaign', clean_(b.utm_campaign, 120));
  set('utm_content', clean_(b.utm_content, 120)); set('first_landing', clean_(b.first_landing, 200));
  set('referrer', clean_(b.referrer, 200));
  sh.appendRow(row.map(cell_));
  return { ok: true };
}

/* ---------------- report: inquiries and sales per post ---------------- */

function buildReport() {
  var test = isTest_();
  var leads = rows_(name_('Leads', test), LEAD_COLS), events = rows_(name_('Events', test), EVENT_COLS);
  var groups = {}, order = [];
  function g(src, camp, content) {
    var key = [src || '(بدون وسم)', camp || '-', content || '-'].join('|');
    if (!groups[key]) { groups[key] = { src: src || '(بدون وسم)', camp: camp || '-', content: content || '-', wa: 0, leads: 0, A: 0, B: 0, C: 0, tons: 0, quoted: 0, won: 0, tonsWon: 0 }; order.push(key); }
    return groups[key];
  }
  events.forEach(function (e) { if (e.type === 'wa_click') g(e.utm_source, e.utm_campaign, e.utm_content).wa++; });
  leads.forEach(function (l) {
    var x = g(l.utm_source, l.utm_campaign, l.utm_content);
    x.leads++; x[l['class']] = (x[l['class']] || 0) + 1; x.tons += Number(l.total_t) || 0;
    if (QUOTED.indexOf(l.status) >= 0 || l.company_quote_no) x.quoted++;
    if (l.status === 'فاز' || l.outcome === 'فاز') { x.won++; x.tonsWon += Number(l.tons_won) || 0; }
  });
  var out = [['تقرير الاستفسارات حسب المنشور — آخر تحديث ' + now_() + (test ? ' (بيانات تجريبية)' : ''), '', '', '', '', '', '', '', '', '', '', ''],
             ['المصدر', 'الحملة', 'المنشور (utm_content)', 'نقرات واتساب', 'استفسارات', 'A', 'B', 'C', 'الأطنان المطلوبة', 'عروض صدرت', 'صفقات فازت', 'الأطنان المباعة']];
  order.map(function (k) { return groups[k]; })
    .sort(function (a, b) { return b.tonsWon - a.tonsWon || b.leads - a.leads || b.wa - a.wa; })
    .forEach(function (x) {
      out.push([x.src, x.camp, x.content, x.wa, x.leads, x.A || 0, x.B || 0, x.C || 0, Math.round(x.tons * 1000) / 1000, x.quoted, x.won, Math.round(x.tonsWon * 1000) / 1000]);
    });
  var ss = book_(), rn = name_('Report', test), sh = ss.getSheetByName(rn) || ss.insertSheet(rn);
  sh.clear();
  sh.getRange(1, 1, out.length, out[0].length).setValues(out.map(function (r) { return r.map(cell_); }));
  sh.setFrozenRows(2);
  return out;
}

function rows_(name, cols) {
  var sh = book_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues();
  return v.slice(1).map(function (r) {
    var o = {};
    cols.forEach(function (c, i) { o[c[0]] = r[i]; });
    return o;
  });
}

/* ---------------- export for the Sales Hub (read path, key required) ---------------- */

// One document per customer: the id is built from the phone number, so the
// same customer always gets the same id (an import that upserts by id cannot
// create a duplicate), and all of their website requests are folded into one
// document. Test rows are left out unless include_test=1 is asked for.
// `match` gives a normalised phone and email so an importer can also match
// customers already in the hub from other sources. Nothing here pushes data
// anywhere: the hub (or an agent) must call this URL with the key.
function exportForHub_(since, includeTest) {
  var all = rows_('Leads', LEAD_COLS).concat(includeTest ? rows_('Leads_TEST', LEAD_COLS) : []);
  var byCustomer = {}, order = [];
  all.forEach(function (l) {
    if (!includeTest && l.test === 'TEST') return;
    if (since && String(l.received) < since) return;
    var phone = normPhone_(String(l.phone).replace(/^'/, ''));
    var key = phone || (l.email ? 'email:' + String(l.email).toLowerCase() : 'ref:' + l.id);
    if (!byCustomer[key]) { byCustomer[key] = []; order.push(key); }
    byCustomer[key].push(l);
  });
  return order.map(function (key) {
    var list = byCustomer[key], l = list[list.length - 1];
    var phone = normPhone_(String(l.phone).replace(/^'/, ''));
    var q = DIAMETERS.filter(function (d) { return l['d' + d]; }).map(function (d) { return 'Ø' + d + ' ' + l['d' + d] + 'ط'; }).join('، ');
    var src = l.utm_source ? (l.utm_source + (l.utm_content ? ' / ' + l.utm_content : '')) : 'مباشر';
    return {
      id: 'web-' + (phone ? phone.replace(/\D/g, '') : String(l.id)),
      match: { phone: phone, email: String(l.email || '').toLowerCase() },
      data: {
        by: 'website', source: 'mashharawi.com (' + src + ')', company: l.company, person: l.name, role: l.position,
        phone: phone, email: l.email, city: l.city, project: l.project, tier: l['class'], tons: String(l.total_t || ''),
        stage: l.status || 'طلب عرض سعر', review: true, test: l.test === 'TEST',
        next: l.next_follow_up instanceof Date ? Utilities.formatDate(l.next_follow_up, TZ, 'yyyy-MM-dd') : String(l.next_follow_up || ''),
        owner: { status: l.ownership || 'لم يُفحص', rep: '', last: '', availableFrom: '', checkedAt: '' },
        notes: 'آخر طلب من الموقع ' + l.id + ': ' + q + ' · ' + (l.grade || '') + (l.cutting ? ' · قص' : '') + (l.epoxy ? ' · إيبوكسي' : '') +
               (l.needed_by ? ' · مطلوب ' + l.needed_by : '') + (l.notes ? ' · ' + l.notes : ''),
        utm: { source: l.utm_source, campaign: l.utm_campaign, content: l.utm_content, first_landing: l.first_landing },
        log: list.map(function (x) {
          return { at: String(x.received), channel: 'الموقع', ref: x.id, text: 'طلب عرض سعر من نموذج الموقع (' + x['class'] + '، ' + x.total_t + ' طن)' };
        }),
        createdAt: String(list[0].received)
      }
    };
  });
}

/* ---------------- daily digest to Omar ---------------- */

function dailyDigest() {
  var test = isTest_(), today = day_(0), due = [], stale = [];
  rows_(name_('Leads', test), LEAD_COLS).forEach(function (l) {
    if (CLOSED.indexOf(l.status) >= 0) return;
    var f = l.next_follow_up instanceof Date ? Utilities.formatDate(l.next_follow_up, TZ, 'yyyy-MM-dd') : String(l.next_follow_up || '');
    if (f && f <= today) due.push(l);
    else if (l.status === 'طلب عرض سعر' && !l.last_contact) stale.push(l);
  });
  if (!due.length && !stale.length) return 'nothing';
  var L = [(test ? '[TEST] ' : '') + '<b>متابعات اليوم ' + today + '</b>'];
  due.forEach(function (l) {
    L.push('• ' + esc_(l.id) + ' — ' + esc_(l.company) + ' (' + esc_(l['class']) + ', ' + esc_(l.total_t) + ' طن) · ' + esc_(l.status));
  });
  if (stale.length) {
    L.push('', '<b>جديدة لم يُتواصل معها:</b>');
    stale.forEach(function (l) { L.push('• ' + esc_(l.id) + ' — ' + esc_(l.company) + ' (' + esc_(l['class']) + ')'); });
  }
  return notify_(L.join('\n'));
}

function dailyJobs() {
  retryAlerts();
  buildReport();
}

/* ---------------- setup, menu, demo data ---------------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('نظام الاستفسارات')
    .addItem('1. إعداد الجداول والمشغلات', 'setup')
    .addItem('2. اختبار Telegram', 'sendTestTelegram')
    .addItem('3. إضافة بيانات تجريبية', 'seedDemoData')
    .addSeparator()
    .addItem('تحديث التقرير الآن', 'buildReport')
    .addItem('إرسال ملخص المتابعات الآن', 'dailyDigest')
    .addItem('إعادة إرسال التنبيهات المتعثرة', 'retryAlerts')
    .addToUi();
}

function setup() {
  var p = props_();
  if (p.getProperty('TEST_MODE') == null) p.setProperty('TEST_MODE', 'true');
  [false, true].forEach(function (test) {
    var sh = sheet_(name_('Leads', test), LEAD_COLS);
    sheet_(name_('Events', test), EVENT_COLS);
    function list(key, values) {
      var rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
      sh.getRange(2, idx_(LEAD_COLS, key) + 1, 1000, 1).setDataValidation(rule);
    }
    list('status', STATUS); list('ownership', OWNERSHIP); list('outcome', OUTCOME);
  });
  sheet_('Audit', AUDIT_COLS);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['dailyDigest', 'buildReport', 'dailyJobs'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyJobs').timeBased().everyDays(1).atHour(6).inTimezone(TZ).create();
  ScriptApp.newTrigger('dailyDigest').timeBased().everyDays(1).atHour(7).inTimezone(TZ).create();
  audit_('setup', 'TEST_MODE=' + p.getProperty('TEST_MODE'));
  return 'ok';
}

function sendTestTelegram() {
  return notify_('[TEST] اختبار ربط نظام الاستفسارات من mashharawi.com ✓');
}

// Fake people only, always written to the *_TEST sheets.
function seedDemoData() {
  var demo = [
    { name: 'عميل تجريبي 1', company: 'شركة تجريبية للمقاولات', position: 'مدير المشتريات', phone: '+966500000001', city: 'الرياض',
      tonnes: { d16: 60, d20: 90, d25: 80 }, grade: '60', stage: 'ready', needed_by: day_(14), utm_source: 'linkedin', utm_campaign: 'carousel-series-1', utm_content: 'c01-bars-per-tonne' },
    { name: 'Demo Buyer 2', company: 'Demo Construction Co.', position: 'Project Engineer', phone: '+966500000002', city: 'جدة',
      tonnes: { d12: 20, d14: 15 }, grade: 'both', stage: 'comparing', needed_by: day_(60), utm_source: 'linkedin', utm_campaign: 'carousel-series-1', utm_content: 'c02-weight-formula' },
    { name: 'عميل تجريبي 3', company: 'مؤسسة تجريبية', position: '', phone: '+966500000003', city: 'القصيم',
      tonnes: { d10: 5 }, grade: 'unsure', stage: 'budget', utm_source: '', utm_campaign: '', utm_content: '' }
  ];
  var p = props_(), prev = p.getProperty('TEST_MODE');
  p.setProperty('TEST_MODE', 'true');
  try {
    var refs = demo.map(function (d) {
      d.kind = 'lead'; d.consent = true; d.elapsed_ms = 20000; d.page = '/ar/quote/'; d.lang = 'ar';
      return handleLead_(d).ref;
    });
    logEvent_({ type: 'wa_click', where: 'floating', page: '/writing/bars-per-tonne/', utm_source: 'linkedin', utm_campaign: 'carousel-series-1', utm_content: 'c01-bars-per-tonne' });
    buildReport();
    return refs;
  } finally {
    if (prev == null) p.deleteProperty('TEST_MODE'); else p.setProperty('TEST_MODE', prev);
  }
}
