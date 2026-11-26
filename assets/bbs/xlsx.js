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

   Scope: this is a purpose-built reader for the structures Excel and common
   writers produce for a plain worksheet, tested against those. It is not a
   full OOXML implementation, and checkXml() is a lightweight well-formedness
   scanner, not a standards-compliant XML parser. Anything outside that scope
   is refused or read as empty cells, which the analyzer then reports.

   What it never does:
   - evaluate a formula. A formula cell returns the value Excel saved with
     the file (the cached result) and is flagged { formula: true }, so the
     analyzer can tell the user; a formula with no saved result is empty.
   - run macros. vbaProject.bin in an .xlsm is never opened.
   - expand XML entities from a DTD. Any part with <!DOCTYPE or <!ENTITY is
     rejected (protects against entity-expansion "billion laughs" files).

   Limits, to stay safe on hostile files: 25 MB per file, 60 MB inflated per
   part and 120 MB for the whole workbook, 2,000 entries, 100,000 rows, 200
   columns. Inflation stops the moment output passes the declared size (zip
   bombs). Every part is checked against its CRC-32 and declared size, local
   headers must match the central directory, duplicate names, ZIP64,
   encryption, external or escaping relationship targets and malformed XML
   are refused with a clear error instead of being half-read.

   Runs in the browser (window.BbsXlsx) and in Node (require) for tests.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BbsXlsx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMITS = {
    fileBytes: 25 * 1024 * 1024,     // the file itself
    partBytes: 60 * 1024 * 1024,     // one inflated part
    totalBytes: 120 * 1024 * 1024,   // all inflated parts of one workbook together
    entries: 2000,                   // ZIP entries
    rows: 100000, cols: 200, sheets: 50
  };

  function XlsxError(code, detail) {
    var e = new Error('xlsx:' + code + (detail ? ' ' + detail : ''));
    e.code = code;
    return e;
  }

  /* ---- ZIP --------------------------------------------------------------- */
  /* Only what Excel writes is accepted: single-disk archives, stored (0) or
     deflated (8) entries, no encryption, no ZIP64. Every structure is bounds
     checked, local headers must agree with the central directory, names
     must be unique, and every part is checked against its CRC-32 and its
     declared size after inflation. Anything else is refused, not repaired. */
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 0x1000000; }

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // flags this reader understands: bit 3 (sizes in a data descriptor; the
  // central directory has them) and bit 11 (UTF-8 names). Bit 0 encrypted,
  // bit 6 strong encryption, bit 13 masked headers: refused.
  var FLAG_ENCRYPTED = 0x0001 | 0x0040 | 0x2000;
  var FLAG_KNOWN = 0x0008 | 0x0800 | 0x0002 | 0x0004;   // 1-2: deflate speed hints

  function readCentralDirectory(bytes) {
    if (bytes.length > LIMITS.fileBytes) throw XlsxError('tooLarge');
    if (bytes.length < 22) throw XlsxError('notZip');
    var eocd = -1;
    var stop = Math.max(0, bytes.length - 22 - 65535);
    for (var i = bytes.length - 22; i >= stop; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd < 0) throw XlsxError('notZip');
    var disk = u16(bytes, eocd + 4), cdDisk = u16(bytes, eocd + 6);
    var countDisk = u16(bytes, eocd + 8), count = u16(bytes, eocd + 10);
    var cdSize = u32(bytes, eocd + 12), cdOff = u32(bytes, eocd + 16);
    if (count === 0xffff || cdOff === 0xffffffff || cdSize === 0xffffffff) throw XlsxError('zip64');
    if (disk !== 0 || cdDisk !== 0 || countDisk !== count) throw XlsxError('multiDisk');
    if (count === 0 || count > LIMITS.entries) throw XlsxError('corrupt', 'entry count');
    if (cdOff + cdSize !== eocd) throw XlsxError('corrupt', 'central directory bounds');

    var entries = {}, list = [];
    var p = cdOff, end = cdOff + cdSize;
    var dec = new TextDecoder('utf-8', { fatal: true });
    for (var n = 0; n < count; n++) {
      if (p + 46 > end || u32(bytes, p) !== 0x02014b50) throw XlsxError('corrupt', 'central header');
      var flags = u16(bytes, p + 8), method = u16(bytes, p + 10);
      var crc = u32(bytes, p + 16), csize = u32(bytes, p + 20), usize = u32(bytes, p + 24);
      var nlen = u16(bytes, p + 28), xlen = u16(bytes, p + 30), clen = u16(bytes, p + 32);
      var diskStart = u16(bytes, p + 34), local = u32(bytes, p + 42);
      if (p + 46 + nlen + xlen + clen > end) throw XlsxError('corrupt', 'central header bounds');
      if (csize === 0xffffffff || usize === 0xffffffff || local === 0xffffffff) throw XlsxError('zip64');
      if (hasZip64Extra(bytes, p + 46 + nlen, xlen)) throw XlsxError('zip64');
      if (diskStart !== 0) throw XlsxError('multiDisk');
      if (flags & FLAG_ENCRYPTED) throw XlsxError('encrypted');
      if (flags & ~(FLAG_KNOWN | FLAG_ENCRYPTED) & 0xffff) throw XlsxError('unsupported', 'flags');
      if (method !== 0 && method !== 8) throw XlsxError('method', String(method));
      if (method === 0 && csize !== usize) throw XlsxError('corrupt', 'stored size');
      var name;
      try { name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen)); } catch (e) { throw XlsxError('corrupt', 'name'); }
      if (!name || /\\|^\/|(^|\/)\.\.(\/|$)|\0/.test(name)) throw XlsxError('corrupt', 'entry name');
      if (Object.prototype.hasOwnProperty.call(entries, name)) throw XlsxError('duplicate', name);
      if (local >= cdOff) throw XlsxError('corrupt', 'local offset');
      var e = { name: name, flags: flags, method: method, crc: crc, csize: csize, usize: usize, local: local, nameBytes: bytes.subarray(p + 46, p + 46 + nlen) };
      entries[name] = e; list.push(e);
      p += 46 + nlen + xlen + clen;
    }
    if (p !== end) throw XlsxError('corrupt', 'central directory size');

    // local headers: present, consistent with the directory, data in bounds,
    // and no two entries sharing bytes
    var spans = [];
    list.forEach(function (e) {
      var q = e.local;
      if (q + 30 > cdOff || u32(bytes, q) !== 0x04034b50) throw XlsxError('corrupt', 'local header');
      var lflags = u16(bytes, q + 6), lmethod = u16(bytes, q + 8);
      var lnlen = u16(bytes, q + 26), lxlen = u16(bytes, q + 28);
      if (q + 30 + lnlen + lxlen > cdOff) throw XlsxError('corrupt', 'local header bounds');
      if (lmethod !== e.method || (lflags & 0xffff & ~0x0006) !== (e.flags & 0xffff & ~0x0006)) throw XlsxError('mismatch', e.name);
      var lname = bytes.subarray(q + 30, q + 30 + lnlen);
      if (lname.length !== e.nameBytes.length) throw XlsxError('mismatch', e.name);
      for (var k = 0; k < lname.length; k++) if (lname[k] !== e.nameBytes[k]) throw XlsxError('mismatch', e.name);
      if (!(e.flags & 0x0008)) {
        if (u32(bytes, q + 14) !== e.crc || u32(bytes, q + 18) !== e.csize || u32(bytes, q + 22) !== e.usize) throw XlsxError('mismatch', e.name);
      }
      e.dataStart = q + 30 + lnlen + lxlen;
      if (e.dataStart + e.csize > cdOff) throw XlsxError('corrupt', 'data bounds');
      spans.push([q, e.dataStart + e.csize]);
    });
    spans.sort(function (a, b) { return a[0] - b[0]; });
    for (var s = 1; s < spans.length; s++) if (spans[s][0] < spans[s - 1][1]) throw XlsxError('corrupt', 'overlapping entries');
    return entries;
  }

  function hasZip64Extra(bytes, start, len) {
    var q = start, end = start + len;
    while (q + 4 <= end) {
      var id = u16(bytes, q), sz = u16(bytes, q + 2);
      if (id === 0x0001) return true;
      q += 4 + sz;
    }
    return false;
  }

  async function inflate(data, expect) {
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
      // stop as soon as the output passes what the archive declared
      if (total > expect) { try { reader.cancel(); } catch (e) { /* ignore */ } throw XlsxError('sizeMismatch'); }
      chunks.push(r.value);
    }
    var out = new Uint8Array(total), o = 0;
    chunks.forEach(function (c) { out.set(c, o); o += c.length; });
    return out;
  }

  async function readEntry(bytes, entries, name, budget) {
    var e = Object.prototype.hasOwnProperty.call(entries, name) ? entries[name] : null;
    if (!e) return null;
    if (e.usize > LIMITS.partBytes) throw XlsxError('partTooLarge');
    if (budget.used + e.usize > LIMITS.totalBytes) throw XlsxError('partTooLarge', 'total');
    var data = bytes.subarray(e.dataStart, e.dataStart + e.csize);
    var raw = e.method === 0 ? data : await inflate(data, e.usize);
    if (raw.length !== e.usize) throw XlsxError('sizeMismatch');
    if (crc32(raw) !== e.crc) throw XlsxError('crc', name);
    budget.used += raw.length;
    var text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(raw); } catch (err) { throw XlsxError('xml', 'encoding'); }
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw XlsxError('dtd');
    checkXml(text, name);
    return text;
  }

  /* Well-formedness check without a full parser: every tag closes in order,
     there is one root element, and no stray '<' in text. Enough to refuse a
     truncated or tampered part instead of reading half of it. */
  function checkXml(text, name) {
    var stack = [], roots = 0, last = 0;
    var re = /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(\/?)([A-Za-z_][\w:.\-]*)((?:\s+[^\s=\/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
    var m;
    while ((m = re.exec(text))) {
      if (text.slice(last, m.index).indexOf('<') >= 0) throw XlsxError('xml', name);
      last = re.lastIndex;
      if (!m[2]) continue;                                   // declaration, comment, CDATA
      if (m[1]) {
        if (m[4] || m[3]) throw XlsxError('xml', name);
        if (stack.pop() !== m[2]) throw XlsxError('xml', name);
      } else if (m[4]) {
        if (!stack.length) roots++;
      } else {
        if (!stack.length) roots++;
        stack.push(m[2]);
      }
    }
    if (text.slice(last).indexOf('<') >= 0 || stack.length || roots !== 1) throw XlsxError('xml', name);
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

  /* A worksheet target must be a part inside this package under xl/, ending
     in .xml. External targets (TargetMode="External", any URI scheme),
     backslashes, empty segments and any ".." that would leave xl/ are
     refused rather than resolved. */
  function resolveTarget(target) {
    if (!target || /^[a-z][a-z0-9+.\-]*:/i.test(target) || /[\\?#%]/.test(target) || target.indexOf('//') >= 0) return null;
    var parts = target.charAt(0) === '/' ? target.slice(1).split('/') : ('xl/' + target).split('/');
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p === '' || p === '.') return null;
      if (p === '..') { if (out.length <= 1) return null; out.pop(); continue; }
      out.push(p);
    }
    if (out[0] !== 'xl' || !/\.xml$/i.test(out[out.length - 1])) return null;
    return out.join('/');
  }

  /* ---- public: open a workbook ------------------------------------------- */
  /* Returns { sheets: [names], readSheet(i) -> Promise<{ rows, formulaCells,
     errorCells, truncated }> }. rows is an array of arrays of string|number|
     boolean|null; formulaCells and errorCells are Sets of "r,c". */
  async function open(buffer) {
    var bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    var entries = readCentralDirectory(bytes);
    if (!Object.prototype.hasOwnProperty.call(entries, 'xl/workbook.xml')) throw XlsxError('notXlsx');
    var budget = { used: 0 };

    var wb = await readEntry(bytes, entries, 'xl/workbook.xml', budget);
    var rels = await readEntry(bytes, entries, 'xl/_rels/workbook.xml.rels', budget);
    if (!rels) throw XlsxError('notXlsx');
    var relMap = {};
    (rels.match(/<Relationship\b[^>]*>/g) || []).forEach(function (t) {
      relMap[attr(t, 'Id')] = { target: attr(t, 'Target'), external: /^external$/i.test(attr(t, 'TargetMode') || '') };
    });
    var sheets = [];
    (wb.match(/<sheet\b[^>]*>/g) || []).forEach(function (t) {
      var rel = relMap[attr(t, 'r:id')];
      if (!rel) throw XlsxError('rels', 'missing');
      if (rel.external) throw XlsxError('rels', 'external');
      var path = resolveTarget(rel.target);
      if (!path) throw XlsxError('rels', 'target');
      if (!Object.prototype.hasOwnProperty.call(entries, path)) throw XlsxError('rels', 'not found');
      sheets.push({ name: attr(t, 'name') || ('Sheet' + (sheets.length + 1)), path: path });
    });
    if (!sheets.length) throw XlsxError('noSheets');
    if (sheets.length > LIMITS.sheets) sheets = sheets.slice(0, LIMITS.sheets);

    var shared = null;
    async function sharedStrings() {
      if (shared) return shared;
      shared = [];
      var xml = await readEntry(bytes, entries, 'xl/sharedStrings.xml', budget);
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
      var xml = await readEntry(bytes, entries, sh.path, budget);
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
        if (t === 's') {
          var si = v == null ? NaN : Number(v);
          if (!(si >= 0 && si < sst.length && Math.floor(si) === si)) { errorCells.add(r + ',' + c); val = null; }
          else val = sst[si];
        }
        else if (t === 'inlineStr') val = runText((/<is>([\s\S]*?)<\/is>/.exec(inner) || [])[1] || '');
        else if (t === 'str') val = v;
        else if (t === 'b') val = v == null ? null : v === '1';
        else if (t === 'e') { val = v; errorCells.add(r + ',' + c); }
        else val = v == null || v === '' ? null : Number(v);
        if (typeof val === 'number' && !isFinite(val)) { val = v; errorCells.add(r + ',' + c); }
        if (hasF) formulaCells.add(r + ',' + c);
        while (rows.length <= r) rows.push([]);
        if (rows[r][c] !== undefined) throw XlsxError('xml', 'cell ' + ref + ' twice');
        rows[r][c] = val === undefined ? null : val;
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

  return { open: open, LIMITS: LIMITS, _internal: { decodeXml: decodeXml, colIndex: colIndex, readCentralDirectory: readCentralDirectory, crc32: crc32, checkXml: checkXml, resolveTarget: resolveTarget } };
});
