/* ==========================================================================
   mashharawi.com, a small read-only XLSX reader for the BBS Analyzer
   --------------------------------------------------------------------------
   Why not a library: the usual choice (SheetJS) is several hundred kB, its
   npm build is no longer updated, and this tool only needs cell values from
   one sheet. An .xlsx file is a ZIP of XML files; browsers (and Node 18+)
   can inflate ZIP entries natively with DecompressionStream('deflate-raw'),
   so the whole reader is this file, with no dependency.

   What it reads: sheet names, then for one sheet at a time every cell's
   value: shared strings, inline strings, numbers, booleans, formula results.

   What it never does:
   - evaluate a formula. A formula cell returns the value Excel saved with
     the file (the cached result) and is flagged { formula: true }, so the
     analyzer can tell the user; a formula with no saved result is empty.
   - run macros. vbaProject.bin in an .xlsm is never opened.
   - expand XML entities from a DTD. Any part with <!DOCTYPE or <!ENTITY is
     rejected (protects against entity-expansion "billion laughs" files).

   Limits, to stay safe on hostile files: 25 MB per file, 60 MB inflated per
   part (inflation stops as soon as it is passed: zip bombs), 100,000 rows,
   200 columns. ZIP64, encrypted and multi-disk archives are refused with a
   clear error instead of being half-read.

   Runs in the browser (window.BbsXlsx) and in Node (require) for tests.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BbsXlsx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMITS = { fileBytes: 25 * 1024 * 1024, partBytes: 60 * 1024 * 1024, rows: 100000, cols: 200, sheets: 50 };

  function XlsxError(code, detail) {
    var e = new Error('xlsx:' + code + (detail ? ' ' + detail : ''));
    e.code = code;
    return e;
  }

  /* ---- ZIP --------------------------------------------------------------- */
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 0x1000000; }

  function readCentralDirectory(bytes) {
    if (bytes.length < 22) throw XlsxError('notZip');
    if (bytes.length > LIMITS.fileBytes) throw XlsxError('tooLarge');
    var eocd = -1;
    var stop = Math.max(0, bytes.length - 22 - 65535);
    for (var i = bytes.length - 22; i >= stop; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd < 0) throw XlsxError('notZip');
    var disk = u16(bytes, eocd + 4), cdDisk = u16(bytes, eocd + 6);
    var count = u16(bytes, eocd + 10), cdSize = u32(bytes, eocd + 12), cdOff = u32(bytes, eocd + 16);
    if (disk !== 0 || cdDisk !== 0) throw XlsxError('multiDisk');
    if (count === 0xffff || cdOff === 0xffffffff || cdSize === 0xffffffff) throw XlsxError('zip64');
    if (cdOff + cdSize > bytes.length) throw XlsxError('corrupt');

    var entries = {};
    var p = cdOff;
    var dec = new TextDecoder('utf-8');
    for (var n = 0; n < count; n++) {
      if (u32(bytes, p) !== 0x02014b50) throw XlsxError('corrupt');
      var flags = u16(bytes, p + 8), method = u16(bytes, p + 10);
      var csize = u32(bytes, p + 20), usize = u32(bytes, p + 24);
      var nlen = u16(bytes, p + 28), xlen = u16(bytes, p + 30), clen = u16(bytes, p + 32);
      var local = u32(bytes, p + 42);
      var name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
      if (csize === 0xffffffff || usize === 0xffffffff || local === 0xffffffff) throw XlsxError('zip64');
      entries[name] = { flags: flags, method: method, csize: csize, usize: usize, local: local };
      p += 46 + nlen + xlen + clen;
    }
    return entries;
  }

  async function inflate(data) {
    if (typeof DecompressionStream === 'undefined') throw XlsxError('noInflate');
    var ds = new DecompressionStream('deflate-raw');
    var writer = ds.writable.getWriter();
    writer.write(data).catch(function () {});
    writer.close().catch(function () {});
    var reader = ds.readable.getReader();
    var chunks = [], total = 0;
    for (;;) {
      var r;
      try { r = await reader.read(); } catch (e) { throw XlsxError('corrupt', 'inflate'); }
      if (r.done) break;
      total += r.value.length;
      if (total > LIMITS.partBytes) { try { reader.cancel(); } catch (e) { /* ignore */ } throw XlsxError('partTooLarge'); }
      chunks.push(r.value);
    }
    var out = new Uint8Array(total), o = 0;
    chunks.forEach(function (c) { out.set(c, o); o += c.length; });
    return out;
  }

  async function readEntry(bytes, entries, name) {
    var e = entries[name];
    if (!e) return null;
    if (e.flags & 1) throw XlsxError('encrypted');
    if (e.usize > LIMITS.partBytes) throw XlsxError('partTooLarge');
    var p = e.local;
    if (u32(bytes, p) !== 0x04034b50) throw XlsxError('corrupt');
    var start = p + 30 + u16(bytes, p + 26) + u16(bytes, p + 28);
    if (start + e.csize > bytes.length) throw XlsxError('corrupt');
    var data = bytes.subarray(start, start + e.csize);
    var raw;
    if (e.method === 0) raw = data;
    else if (e.method === 8) raw = await inflate(data);
    else throw XlsxError('method', String(e.method));
    var text = new TextDecoder('utf-8').decode(raw);
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw XlsxError('dtd');
    return text;
  }

  /* ---- XML helpers -------------------------------------------------------- */
  function decodeXml(s) {
    return s
      .replace(/_x([0-9A-Fa-f]{4})_/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9A-Fa-f]+);/g, function (_, e) {
        if (e === 'lt') return '<';
        if (e === 'gt') return '>';
        if (e === 'amp') return '&';
        if (e === 'quot') return '"';
        if (e === 'apos') return "'";
        var cp = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
      });
  }
  function attr(tag, name) {
    var m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag);
    return m ? decodeXml(m[1]) : null;
  }
  // text of all <t> runs, ignoring phonetic (<rPh>) runs used in Japanese files
  function runText(xml) {
    xml = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    var out = '', re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g, m;
    while ((m = re.exec(xml))) out += m[1] ? decodeXml(m[1]) : '';
    return out;
  }

  function colIndex(ref) {
    var m = /^([A-Z]{1,3})/.exec(ref || '');
    if (!m) return -1;
    var n = 0;
    for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
    return n - 1;
  }
  function rowIndex(ref) {
    var m = /(\d+)$/.exec(ref || '');
    return m ? parseInt(m[1], 10) - 1 : -1;
  }

  function resolveTarget(target) {
    if (!target) return null;
    if (target.charAt(0) === '/') return target.slice(1);
    var parts = ('xl/' + target).split('/'), out = [];
    parts.forEach(function (p) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); });
    return out.join('/');
  }

  /* ---- public: open a workbook ------------------------------------------- */
  /* Returns { sheets: [names], readSheet(i) -> Promise<{ rows, formulaCells,
     errorCells, truncated }> }. rows is an array of arrays of string|number|
     boolean|null; formulaCells and errorCells are Sets of "r,c". */
  async function open(buffer) {
    var bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    var entries = readCentralDirectory(bytes);
    if (!entries['xl/workbook.xml']) throw XlsxError('notXlsx');

    var wb = await readEntry(bytes, entries, 'xl/workbook.xml');
    var rels = await readEntry(bytes, entries, 'xl/_rels/workbook.xml.rels') || '';
    var relMap = {};
    (rels.match(/<Relationship\b[^>]*>/g) || []).forEach(function (t) { relMap[attr(t, 'Id')] = attr(t, 'Target'); });
    var sheets = [];
    (wb.match(/<sheet\b[^>]*>/g) || []).forEach(function (t) {
      var rid = attr(t, 'r:id');
      var path = resolveTarget(relMap[rid]);
      if (path && entries[path]) sheets.push({ name: attr(t, 'name') || ('Sheet' + (sheets.length + 1)), path: path });
    });
    if (!sheets.length) throw XlsxError('noSheets');
    if (sheets.length > LIMITS.sheets) sheets = sheets.slice(0, LIMITS.sheets);

    var shared = null;
    async function sharedStrings() {
      if (shared) return shared;
      shared = [];
      var xml = await readEntry(bytes, entries, 'xl/sharedStrings.xml');
      if (xml) {
        var re = /<si>([\s\S]*?)<\/si>|<si\/>/g, m;
        while ((m = re.exec(xml))) shared.push(m[1] ? runText(m[1]) : '');
      }
      return shared;
    }

    async function readSheet(i) {
      var sh = sheets[i];
      if (!sh) throw XlsxError('noSheets');
      var sst = await sharedStrings();
      var xml = await readEntry(bytes, entries, sh.path);
      var rows = [], formulaCells = new Set(), errorCells = new Set();
      var truncated = false;
      var re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, m;
      var lastRow = -1, lastCol = -1;
      while ((m = re.exec(xml))) {
        var a = m[1], inner = m[2] || '';
        var ref = attr(' ' + a, 'r');
        var r = ref ? rowIndex(ref) : lastRow;
        var c = ref ? colIndex(ref) : lastCol + 1;
        if (r < 0 || c < 0) continue;
        lastRow = r; lastCol = c;
        if (r >= LIMITS.rows) { truncated = true; break; }
        if (c >= LIMITS.cols) continue;
        var t = attr(' ' + a, 't') || 'n';
        var hasF = /<f\b/.test(inner);
        var vm = /<v>([\s\S]*?)<\/v>/.exec(inner);
        var v = vm ? decodeXml(vm[1]) : null;
        var val = null;
        if (t === 's') val = v == null ? null : (sst[parseInt(v, 10)] != null ? sst[parseInt(v, 10)] : null);
        else if (t === 'inlineStr') val = runText((/<is>([\s\S]*?)<\/is>/.exec(inner) || [])[1] || '');
        else if (t === 'str') val = v;
        else if (t === 'b') val = v == null ? null : v === '1';
        else if (t === 'e') { val = v; errorCells.add(r + ',' + c); }
        else val = v == null || v === '' ? null : Number(v);
        if (typeof val === 'number' && !isFinite(val)) { val = v; errorCells.add(r + ',' + c); }
        if (hasF) formulaCells.add(r + ',' + c);
        while (rows.length <= r) rows.push([]);
        rows[r][c] = val;
      }
      // dense rows, null for empty cells
      var width = 0;
      rows.forEach(function (row) { if (row.length > width) width = row.length; });
      rows = rows.map(function (row) {
        var out = new Array(width);
        for (var k = 0; k < width; k++) out[k] = row[k] === undefined ? null : row[k];
        return out;
      });
      return { rows: rows, formulaCells: formulaCells, errorCells: errorCells, truncated: truncated };
    }

    return { sheets: sheets.map(function (s) { return s.name; }), readSheet: readSheet };
  }

  return { open: open, LIMITS: LIMITS, _internal: { decodeXml: decodeXml, colIndex: colIndex, readCentralDirectory: readCentralDirectory } };
});
