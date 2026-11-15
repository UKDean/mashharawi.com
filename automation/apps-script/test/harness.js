// Runs Code.gs inside Node with in-memory fakes of the Google services it uses.
const fs = require('fs'), vm = require('vm'), path = require('path');

function makeSheet(name) {
  const rows = [];
  const sh = {
    name, rows, frozen: 0, validations: [],
    appendRow(r) { if (sh.failAppend) throw new Error('sheet unavailable'); rows.push(r.slice()); },
    getLastRow() { return rows.length; },
    setFrozenRows(n) { sh.frozen = n; },
    clear() { rows.length = 0; },
    getDataRange() { return { getValues: () => rows.map(r => r.slice()) }; },
    getRange(r, c, nr = 1, nc = 1) {
      return {
        setValue(v) { while (rows.length < r) rows.push([]); rows[r - 1][c - 1] = v; },
        setValues(vs) { vs.forEach((row, i) => { while (rows.length < r + i) rows.push([]); row.forEach((v, j) => { rows[r - 1 + i][c - 1 + j] = v; }); }); },
        getValues() { return rows.slice(r - 1, r - 1 + nr).map(x => x.slice(c - 1, c - 1 + nc)); },
        setDataValidation(rule) { sh.validations.push({ c, rule }); }
      };
    }
  };
  return sh;
}

function load(opts = {}) {
  const sheets = {};
  const props = Object.assign({}, opts.props || {});
  const cache = {};
  const fetches = [], mails = [], triggers = [];
  const ss = {
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => { const sh = (sheets[n] = makeSheet(n)); if (opts.appendFail) sh.failAppend = true; return sh; }
  };
  const appendFail = opts.appendFail;
  const ctx = {
    console, JSON, Math, Date, String, Number, Object, Array, RegExp, Error,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      openById: () => { throw new Error('openById must never be used (currentonly scope)'); },
      newDataValidation: () => { const r = { requireValueInList(v) { r.values = v; return r; }, setAllowInvalid() { return r; }, build() { return r; } }; return r; },
      getUi: () => ({ createMenu: () => { const m = { addItem() { return m; }, addToUi() {} }; return m; } })
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock() { return opts.lockBusy ? false : true; }, releaseLock() {} }) },
    UrlFetchApp: { fetch: (url, o) => { fetches.push({ url, o, body: JSON.parse(o.payload) }); const code = opts.telegramCode || 200; if (code === 'throw') throw new Error('net'); return { getResponseCode: () => code }; } },
    MailApp: { sendEmail: m => mails.push(m) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) },
    Utilities: {
      formatDate(d, tz, f) {
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
        return f.replace('yyyy', p.year).replace('yy', p.year.slice(2)).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute);
      }
    },
    ScriptApp: {
      getProjectTriggers: () => [],
      deleteTrigger() {},
      newTrigger: fn => { const t = { fn, timeBased() { return t; }, everyDays() { return t; }, atHour(h) { t.h = h; return t; }, inTimezone() { return t; }, create() { triggers.push(t); return t; } }; return t; }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'), ctx);
  return { ctx, sheets, props, fetches, mails, triggers, cache };
}

function post(env, body) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const out = env.ctx.doPost({ postData: { contents: raw } });
  return JSON.parse(out.text);
}
function get(env, parameter) { return JSON.parse(env.ctx.doGet({ parameter }).text); }

module.exports = { load, post, get };
