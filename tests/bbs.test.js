/* Tests for the BBS Analyzer: assets/bbs/xlsx.js, engine.js, i18n.js, and
   the hand-off to the cutting optimizer engine. Run: node --test tests/*.test.js
   Expected weights for the workbook fixtures were computed independently in
   Python with decimal arithmetic (tests/fixtures/bbs/expected.json); the
   workbooks themselves were written by openpyxl, not by this code. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const X = require('../assets/bbs/xlsx.js');
const E = require('../assets/bbs/engine.js');
const TXT = require('../assets/bbs/i18n.js');
const CutOpt = require('../assets/cutopt/engine.js');

const FX = path.join(__dirname, 'fixtures', 'bbs');
const expected = JSON.parse(fs.readFileSync(path.join(FX, 'expected.json'), 'utf8'));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);

/* Run a grid through detection + analysis the way the page does. */
function run(grid, over) {
  const det = E.detectHeader(grid);
  assert.ok(det, 'header not detected');
  const opts = Object.assign({ headerRow: det.headerRow, mapping: det.mapping, units: det.units }, over || {});
  return E.analyze(grid, opts);
}
async function sheet(file, i) {
  const wb = await X.open(fs.readFileSync(path.join(FX, file)));
  return { wb, s: await wb.readSheet(i || 0) };
}
async function rejects(file, code) {
  await assert.rejects(async () => { const wb = await X.open(fs.readFileSync(path.join(FX, file))); await wb.readSheet(0); },
    e => e.code === code, file + ' should fail with ' + code);
}

/* ---- CSV and pasted ranges -------------------------------------------- */
test('CSV: quotes, embedded delimiters and newlines, BOM, CRLF', () => {
  const t = '﻿Mark,Dia,Note\r\n"A,1",16,"line1\nline2"\r\n"say ""hi""",12,\r\n';
  assert.deepEqual(E.parseDelimited(t), [['Mark', 'Dia', 'Note'], ['A,1', '16', 'line1\nline2'], ['say "hi"', '12', '']]);
});

test('CSV: delimiter detection (comma, semicolon, tab)', () => {
  assert.equal(E.detectDelimiter('a;b;c\n1;2,5;3\n4;5;6'), ';');
  assert.equal(E.detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
  assert.equal(E.detectDelimiter('a,b,c\n1,2,3'), ',');
});

/* ---- header recognition, three languages ------------------------------ */
test('headers are recognised in English, Arabic and Chinese, with units', () => {
  for (const lang of ['en', 'ar', 'zh']) {
    const det = E.detectHeader(TXT[lang].sample);
    assert.ok(det, lang);
    assert.equal(det.headerRow, 2, lang);
    for (const f of ['member', 'mark', 'diameter', 'grade', 'shape', 'length', 'nMembers', 'nEach', 'qty', 'weight']) assert.ok(det.mapping[f] != null, lang + ' ' + f);
    assert.equal(det.units.length, 'mm', lang);
    assert.equal(det.units.weight, 'kg', lang);
  }
});

test('the sample schedule gives identical results in all three languages', () => {
  const r = ['en', 'ar', 'zh'].map(l => run(TXT[l].sample));
  r.forEach(x => assert.equal(x.ok, true));
  for (const k of ['bars', 'lengthM', 'weightKg']) { assert.equal(r[1].summary.totals[k], r[0].summary.totals[k]); assert.equal(r[2].summary.totals[k], r[0].summary.totals[k]); }
  // independently: 860 bars, 1859.6 m; the 12.5 m line is excluded, the no-grade line counted
  assert.equal(r[0].summary.totals.bars, 860);
  near(r[0].summary.totals.lengthM, 1859.6, 1e-9);
  near(r[0].summary.totals.weightKg, 0.006165 * (256 * 462 + 400 * 151.2 + 100 * 473.6 + 144 * 772.8), 1e-9);
  assert.deepEqual(r[0].issues.map(i => i.codes[0]), ['lenComma', 'overStock', 'unreadable']);
  assert.equal(r[0].excluded.overStock.bars, 4);
  assert.deepEqual(r[0].notForOptimizer, { rows: 1, bars: 20 });
});

test('length unit is never guessed: no unit in header and none chosen stops the analysis', () => {
  const g = [['Dia', 'Length', 'Qty'], [16, 2350, 4]];
  const det = E.detectHeader(g);
  assert.equal(det.units.length, null);
  const r = E.analyze(g, { headerRow: 0, mapping: det.mapping, units: det.units });
  assert.equal(r.ok, false); assert.equal(r.error, 'lengthUnit');
  const ok = E.analyze(g, { headerRow: 0, mapping: det.mapping, units: { length: 'mm' } });
  assert.equal(ok.ok, true);
});

test('manual column mapping overrides detection; configuration errors are reported', () => {
  const g = [['col1', 'col2', 'col3', 'col4'], ['x', 'Y16', '4.2', '10']];
  assert.equal(E.detectHeader(g), null);
  const r = E.analyze(g, { headerRow: 0, mapping: { diameter: 1, length: 2, qty: 3, mark: 0 }, units: { length: 'm' } });
  assert.equal(r.ok, true);
  assert.equal(r.rows[0].lengthMm, 4200);
  assert.equal(r.rows[0].mark, 'x');
  assert.deepEqual(E.analyze(g, { headerRow: 0, mapping: { diameter: 1 }, units: { length: 'm' } }).missing, ['length', 'qty']);
  assert.equal(E.analyze(g, { headerRow: 0, mapping: { diameter: 1, length: 1, qty: 3 }, units: { length: 'm' } }).error, 'sameColumn');
});

/* ---- units and arithmetic ---------------------------------------------- */
test('unit conversion: metres to millimetres without float noise', () => {
  const g = [['Dia', 'Length (m)', 'Qty'], [12, 2.35, 1], [12, '0.1', 3], [12, 7.205, 1], [12, '.5', 2]];
  const r = run(g);
  assert.deepEqual(r.rows.map(x => x.lengthMm), [2350, 100, 7205, 500]);
});

test('values that fit only the other unit are refused, not converted', () => {
  const m = run([['Dia', 'Length (m)', 'Qty'], [12, 2350, 1]]);
  assert.deepEqual(m.issues[0].codes, ['unitLooksMm']);
  const mm = run([['Dia', 'Length (mm)', 'Qty'], [12, 2.35, 1]]);
  assert.deepEqual(mm.issues[0].codes, ['unitLooksM']);
});

test('weights match independent hand calculations', () => {
  const r = run([['Dia', 'Cut length (mm)', 'Total No.'], [16, 12000, 1], [32, 1000, 3], [10, 1000, 1]]);
  near(r.rows[0].weightKg, 0.006165 * 256 * 12, 1e-12);          // 18.93888
  near(r.rows[1].weightKg, 0.006165 * 1024 * 3, 1e-12);          // 18.93888
  near(r.rows[2].weightKg, 0.006165 * 100 * 1, 1e-12);           // 0.6165
  near(E.unitWeight(16), 1.57824, 1e-12);
  near(E.unitWeight(25), 3.853125, 1e-12);
});

test('quantity from members x bars in each, and contradictions are excluded', () => {
  const r = run([['Dia', 'Length (mm)', 'No. of members', 'No. in each'], [16, 2000, 4, 6], [16, 2000, 4, 1.5], [16, 2000, '', 3]]);
  assert.equal(r.rows[0].qty, 24);
  assert.deepEqual(r.issues.map(i => i.codes[0]), ['qtyFactors', 'qtyFactors']);
  assert.ok(r.warnings.some(w => w.code === 'qtyFromFactors'));
  const c = run([['Dia', 'Length (mm)', 'No. of members', 'No. in each', 'Total No.'], [16, 2000, 4, 6, 25]]);
  assert.deepEqual(c.issues[0].codes, ['qtyMismatch']);
});

/* ---- validation --------------------------------------------------------- */
test('invalid data is excluded with a reason and never filled in', () => {
  const g = [['Mark', 'Dia', 'Length (mm)', 'Qty'],
    ['a', '', 2000, 1], ['b', '#5', 2000, 1], ['c', 70, 2000, 1], ['d', 'T16', '', 1], ['e', 16, 'abc', 1],
    ['f', 16, '2,350', 1], ['g', 16, -100, 1], ['h', 16, 0, 1], ['i', 16, 2000, 0], ['j', 16, 2000, 2.5],
    ['k', 16, 2000, ''], ['l', 16, 12500, 1], ['m', 16, 2000, 'ten'], ['n', 16, 2000, 4]];
  const r = run(g);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].mark, 'n');
  assert.deepEqual(r.issues.map(i => i.mark + ':' + i.codes.join('+')), [
    'a:diaMissing', 'b:diaImperial', 'c:diaInvalid', 'd:lenMissing', 'e:lenInvalid', 'f:lenComma', 'g:lenNotPositive',
    'h:lenNotPositive', 'i:qtyInvalid', 'j:qtyFraction', 'k:qtyMissing', 'l:overStock', 'm:qtyInvalid']);
});

test('formula-looking text is data, never evaluated', () => {
  const r = run(E.parseDelimited('Dia,Length (mm),Qty\n16,=1000+1000,2\n=HYPERLINK("x"),2000,1\n'));
  assert.equal(r.rows.length, 0);
  assert.deepEqual(r.issues.map(i => i.codes[0]), ['lenInvalid', 'diaInvalid']);
});

test('duplicate bar marks: same data, conflicting data, scoped by member', () => {
  const g = [['Member', 'Mark', 'Dia', 'Length (mm)', 'Qty'],
    ['B1', '01', 16, 2000, 4], ['B1', '01', 16, 2000, 4], ['B2', '01', 20, 3000, 2],
    ['C1', '05', 12, 1000, 1], ['C1', '05', 16, 1000, 1]];
  const r = run(g);
  const codes = r.warnings.filter(w => /dup/.test(w.code)).map(w => w.code + ':' + w.member + '/' + w.mark + ':' + w.rows.join(','));
  assert.deepEqual(codes.sort(), ['dupMark:B1/01:2,3', 'dupMarkConflict:C1/05:5,6']);
  assert.equal(r.rows.length, 5, 'duplicates are flagged, not dropped');
});

test('grades: spellings folded, different grades never merged, missing grade not assigned', () => {
  const g = [['Dia', 'Grade', 'Length (mm)', 'Qty'], [16, 'Gr60', 1000, 1], [16, 'grade 60', 1000, 1], [16, 'A615 Gr.60', 1000, 1],
    [16, 'Gr80', 1000, 1], [16, '', 1000, 1], [16, 'B500B', 1000, 1]];
  const r = run(g);
  const byG = Object.fromEntries(r.summary.byDiameterGrade.map(x => [x.gradeKey, x.bars]));
  assert.deepEqual(byG, { GR60: 3, GR80: 1, '': 1, B500B: 1 });
  const codes = r.warnings.map(w => w.code);
  assert.ok(codes.includes('multiGrade') && codes.includes('gradePartlyMissing') && codes.includes('gradeSpellings'));
});

test('multiple diameters: totals by diameter add up to the grand total', () => {
  const g = [['Dia', 'Length (mm)', 'Qty']];
  for (const d of [10, 12, 14, 16, 18, 20, 25, 32]) g.push([d, 1000 + d, d]);
  const r = run(g);
  assert.equal(r.summary.byDiameter.length, 8);
  near(r.summary.byDiameter.reduce((a, x) => a + x.weightKg, 0), r.summary.totals.weightKg, 1e-9);
  assert.equal(r.summary.byDiameter.reduce((a, x) => a + x.bars, 0), r.summary.totals.bars);
});

test('non-standard diameters and sheet weights are warned about', () => {
  const g = [['Dia', 'Length (mm)', 'Qty', 'Weight (kg)'], [17, 1000, 1, ''], [16, 12000, 1, 18.939], [16, 1000, 10, 20]];
  const r = run(g);
  const codes = r.warnings.map(w => w.code);
  assert.ok(codes.includes('diaNonStandard') && codes.includes('weightDiff'));
  assert.deepEqual(r.rows[2].warnings, ['weightDiff']);
  assert.deepEqual(r.rows[1].warnings, []);              // 12 m x 1.57824 = 18.939 kg: matches
});

/* ---- XLSX ------------------------------------------------------------- */
test('XLSX (openpyxl): basic schedule matches independent totals', async () => {
  const { wb, s } = await sheet('basic.xlsx');
  assert.deepEqual(wb.sheets, ['BBS']);
  const r = run(s.rows, { formulaCells: s.formulaCells, errorCells: s.errorCells });
  assert.equal(r.ok, true);
  assert.equal(r.summary.totals.bars, expected.basic.bars);
  near(r.summary.totals.weightKg, Number(expected.basic.weightKg), 1e-9);
  near(r.summary.totals.lengthM, Number(expected.basic.lengthM), 1e-9);
  for (const x of r.summary.byDiameter) near(x.weightKg, Number(expected.basic.byDia[String(x.label)]), 1e-9);
  assert.deepEqual(r.issues.map(i => i.codes[0]), ['unreadable']);   // the "Total" line
  assert.ok(r.warnings.some(w => w.code === 'gradeSpellings'));
});

test('XLSX: picks the right sheet, Arabic headers, lengths in metres', async () => {
  const { wb, s } = await sheet('multisheet.xlsx', 1);
  assert.deepEqual(wb.sheets, ['Cover', 'جدول التفريد']);
  const r = run(s.rows);
  assert.equal(r.summary.totals.bars, expected.multisheet.bars);
  near(r.summary.totals.weightKg, Number(expected.multisheet.weightKg), 1e-9);
  assert.equal(E.detectHeader((await wb.readSheet(0)).rows), null);
});

test('XLSX: formulas give their saved value and are flagged; errors and blanks are handled', async () => {
  for (const f of ['crafted-stored.xlsx', 'crafted-deflate.xlsx']) {
    const { wb, s } = await sheet(f);
    assert.deepEqual(wb.sheets, ['S & 1']);
    assert.equal(s.rows[0][1], 'Cut length (mm)');            // rich-text runs joined
    assert.equal(s.rows[1][3], 'A < B & CA');                   // entities and _x0041_ decoded
    assert.equal(s.rows[0][3], 'Mark');                         // inline string
    assert.equal(s.rows[1][1], 2350);                           // cached formula result
    assert.ok(s.formulaCells.has('1,1'));
    assert.ok(s.errorCells.has('2,1'));
    assert.equal(s.rows[3][1], null);                           // formula with no saved value
    assert.equal(s.rows[4][2], true);                           // boolean
    assert.equal(s.rows[5].every(v => v === null), true);       // missing row 6 is blank
    const r = run(s.rows, { formulaCells: s.formulaCells, errorCells: s.errorCells });
    assert.deepEqual(r.rows.map(x => x.row), [2, 7]);
    assert.deepEqual(r.rows[0].warnings, ['formula']);
    const why = Object.fromEntries(r.issues.map(i => [i.row, i.codes]));
    assert.ok(why[3].includes('cellError'));
    assert.deepEqual(why[4], ['lenMissing']);
    assert.deepEqual(why[5], ['qtyInvalid']);                   // TRUE is not a number of bars
  }
});

test('XLSX: hostile and unsupported files are refused with a reason', async () => {
  await rejects('dtd.xlsx', 'dtd');
  await rejects('bomb-declared.xlsx', 'partTooLarge');
  await rejects('bomb-lying.xlsx', 'sizeMismatch');
  await rejects('encrypted.xlsx', 'encrypted');
  await rejects('not-a-zip.xlsx', 'notZip');
  await assert.rejects(X.open(new Uint8Array(30 * 1024 * 1024)), e => e.code === 'tooLarge');
});

/* ---- large inputs ------------------------------------------------------ */
test('large XLSX: 20,000 rows, exact totals, quickly', async () => {
  const t0 = Date.now();
  const { s } = await sheet('large.xlsx');
  const r = run(s.rows);
  const ms = Date.now() - t0;
  assert.equal(r.rows.length, expected.large.rows);
  assert.equal(r.summary.totals.bars, expected.large.bars);
  near(r.summary.totals.weightKg, Number(expected.large.weightKg), 1e-6);
  assert.ok(ms < 8000, 'took ' + ms + ' ms');
});

test('large CSV: 100,000 rows analysed, the row limit enforced beyond that', () => {
  const lines = ['Mark,Dia,Length (mm),Qty'];
  for (let i = 0; i < 100000; i++) lines.push(`M${i},${[10, 12, 16, 20][i % 4]},${1000 + (i % 9000)},${1 + (i % 7)}`);
  const t0 = Date.now();
  const r = run(E.parseDelimited(lines.join('\n')));
  assert.equal(r.rows.length, 100000);
  assert.ok(Date.now() - t0 < 8000);
  lines.push('X,16,1000,1');
  const big = E.parseDelimited(lines.join('\n'));
  const det = E.detectHeader(big);
  assert.equal(E.analyze(big, { headerRow: det.headerRow, mapping: det.mapping, units: det.units }).error, 'tooManyRows');
});

/* ---- hand-off to the cutting optimizer --------------------------------- */
test('transfer groups by diameter, grade and length, never across them, and feeds the optimizer', () => {
  const g = [['Mark', 'Dia', 'Grade', 'Length (mm)', 'Qty'],
    ['a', 16, 'Gr60', 2350, 10], ['b', 16, 'Gr60', 2350, 5], ['c', 16, 'Gr80', 2350, 7], ['d', 20, 'Gr60', 2350, 3],
    ['e', 16, 'Gr60', 13000, 2], ['f', 12, '', 1000, 4], ['g', 12, 'Gr60', 999.6, 4]];
  const r = run(g);
  const t = E.buildTransfer(r.rows);
  assert.deepEqual(t.items, [[12, 'Gr60', 1000, 4], [16, 'Gr60', 2350, 15], [16, 'Gr80', 2350, 7], [20, 'Gr60', 2350, 3]]);
  assert.deepEqual(t.tooLong, []);                                     // row e never got this far
  assert.deepEqual(t.noGrade, { rows: [7], bars: 4 });                 // row f held back
  assert.equal(t.rounded, 1);
  // round trip through the URL fragment format the optimizer reads
  const payload = E.encodeTransfer(t.items);
  assert.match(payload, /^[A-Za-z0-9_-]+$/);
  const back = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  assert.deepEqual(back, { v: 1, items: t.items });
  // the optimizer engine receives the same pieces, in separate groups
  const res = CutOpt.optimize({ stockLength: 12000, kerf: 0, items: back.items.map(i => ({ diameter: i[0], grade: i[1], length: i[2], qty: i[3] })) });
  assert.equal(res.ok, true);
  assert.equal(res.totals.pieces, 29);
  assert.equal(res.groups.length, 4);
  // the original rows are untouched
  assert.equal(r.rows.length, 6);
  assert.equal(r.rows[5].lengthMm, 999.6);
});

test('transfer payload with Arabic and Chinese grade text survives encoding', () => {
  const items = [[16, 'درجة٦٠', 1000, 1], [12, '牌号', 2000, 2]];
  const p = E.encodeTransfer(items);
  assert.deepEqual(JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).items, items);
});

test('the optimizer page reads the fragment defensively', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'cutopt', 'app.js'), 'utf8');
  assert.match(src, /history\.replaceState/);                         // removed from the address bar
  assert.match(src, /data\.v !== 1/);                                  // versioned format
  assert.match(src, /items\.length !== data\.items\.length/);          // any bad item rejects the lot
  assert.doesNotMatch(src, /coRun'\)\.click|run\(\);\s*\}\s*$/m);      // never runs automatically
});

/* ---- interface text ---------------------------------------------------- */
function shape(o) {
  if (typeof o === 'function') return 'fn';
  if (Array.isArray(o)) return 'array';
  if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).sort().map(k => [k, shape(o[k])]));
  return typeof o;
}
test('English, Arabic and Chinese have the same interface keys', () => {
  assert.deepEqual(shape(TXT.ar), shape(TXT.en));
  assert.deepEqual(shape(TXT.zh), shape(TXT.en));
  for (const l of ['en', 'ar', 'zh']) {
    for (const k of Object.keys(TXT.en.issue)) assert.ok(TXT[l].issue[k], l + ' issue ' + k);
    assert.equal(TXT[l].assume.length, 4);
    assert.match(TXT[l].assume[2], /12,000/);
    assert.match(TXT[l].assume[0], /0\.006165/);
  }
});
test('every issue and warning code the engine can emit has a message', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'bbs', 'engine.js'), 'utf8');
  // codes are the quoted names pushed onto errs; the reader's own 'why' values (missing, comma...) are not codes
  const whys = new Set(['imperial', 'missing', 'comma', 'fraction', 'range', 'number']);
  const issueCodes = new Set([...src.matchAll(/errs\.push\(([^)]*)\)/g)].flatMap(m => [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map(x => x[1])).filter(c => !whys.has(c)));
  issueCodes.add('unreadable');
  const warnCodes = new Set([...src.matchAll(/code: '([a-zA-Z]+)'/g)].map(m => m[1]));
  for (const l of ['en', 'ar', 'zh']) {
    for (const c of issueCodes) assert.ok(TXT[l].issue[c], l + ' missing issue text ' + c);
    for (const c of warnCodes) assert.ok(TXT[l].warn[c], l + ' missing warning text ' + c);
  }
});

/* ---- privacy and security ---------------------------------------------- */
test('no network, storage or HTML-injection APIs in the analyzer code', () => {
  for (const f of ['xlsx.js', 'engine.js', 'i18n.js', 'app.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'bbs', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const bad of [/\bfetch\s*\(/, /XMLHttpRequest/, /localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /sendBeacon/,
      /\.innerHTML/, /outerHTML/, /insertAdjacentHTML/, /\beval\s*\(/, /new Function/, /WebSocket/, /importScripts/]) {
      assert.doesNotMatch(src, bad, f + ' uses ' + bad);
    }
  }
});

test('CSV export neutralises formula injection', () => {
  assert.equal(E.csvCell('=HYPERLINK("http://x")'), '"\'=HYPERLINK(""http://x"")"');
  assert.equal(E.csvCell('+1+1'), "'+1+1");
  assert.equal(E.csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(E.csvCell('-cmd'), "'-cmd");
  assert.equal(E.csvCell('|calc'), "'|calc");
  assert.equal(E.csvCell(-12.5), '-12.5');
  assert.equal(E.csvCell('a,b'), '"a,b"');
  assert.ok(E.toCsv([['x']]).startsWith('﻿'));
});

/* ==== review corrections: 12 m rule, grades, duplicates, XLSX, formula ==== */

test('12 m rule: 12,000 mm included; 12,000.001 mm, 12,500 and 13,000 mm excluded', () => {
  const g = [['Mark', 'Dia', 'Grade', 'Cut length (mm)', 'Qty'],
    ['a', 16, 'Gr60', 12000, 2], ['b', 16, 'Gr60', 12000.001, 3], ['c', 16, 'Gr60', 12500, 4], ['d', 16, 'Gr60', 13000, 5]];
  const r = run(g);
  assert.deepEqual(r.rows.map(x => x.mark), ['a']);
  assert.deepEqual(r.issues.map(i => [i.mark, i.codes, i.diameter, i.lengthMm, i.qty]), [
    ['b', ['overStock'], 16, 12000.001, 3], ['c', ['overStock'], 16, 12500, 4], ['d', ['overStock'], 16, 13000, 5]]);
  assert.equal(TXT.en.issue.overStock, 'Cut length exceeds the 12 m stock bar limit.');
  // the same boundary in metres
  const m = run([['Dia', 'Length (m)', 'Qty'], [16, 12, 1], [16, '12.000001', 1], [16, 12.5, 1]]);
  assert.deepEqual(m.rows.map(x => x.lengthMm), [12000]);
  assert.deepEqual(m.issues.map(i => i.lengthExact), ['12000.001', '12500']);   // exact text, no float noise
});

test('excluded over-length rows change no total and no summary', () => {
  const base = [['Member', 'Mark', 'Dia', 'Grade', 'Shape', 'Cut length (mm)', 'Qty'],
    ['B1', '1', 16, 'Gr60', '21', 2350, 10], ['B1', '2', 20, 'Gr80', '00', 3150, 6], ['C1', '3', 12, 'Gr60', '51', 1200, 40]];
  const withOver = base.concat([['C1', '4', 16, 'Gr60', '21', 12500, 50], ['C1', '5', 25, 'Gr80', '99', 13000, 7], ['C1', '6', 32, 'NEW', 'Z', 12000.5, 3]]);
  const a = run(base), b = run(withOver);
  assert.deepEqual(b.summary, a.summary);             // totals, by diameter, grade, shape, diameter+grade
  assert.deepEqual(b.rows, a.rows);
  assert.deepEqual(b.excluded.overStock, { rows: 3, bars: 60, lengthM: 625 + 91 + 36.0015, weightKg: b.excluded.overStock.weightKg, rowsWithoutQty: 0 });
  near(b.excluded.overStock.weightKg, 0.006165 * (256 * 625 + 625 * 91 + 1024 * 36.0015), 1e-9);
  assert.deepEqual(E.buildTransfer(b.rows), E.buildTransfer(a.rows));
});

test('over-length rows can never reach the optimizer, even if forced into the transfer', () => {
  const ok = { diameter: 16, grade: 'Gr60', gradeKey: 'GR60', qty: 1, withinStock: true };
  const forged = [Object.assign({}, ok, { row: 9, lengthMm: 12000.4 }),                    // flag forged, value over
                  Object.assign({}, ok, { row: 10, lengthMm: 13000 }),
                  Object.assign({}, ok, { row: 11, lengthMm: NaN }),
                  Object.assign({}, ok, { row: 12, lengthMm: 12000, withinStock: undefined }), // never decided
                  Object.assign({}, ok, { row: 13, lengthMm: 12000.0000001 }),
                  Object.assign({}, ok, { row: 14, lengthMm: 12000 })];
  const t = E.buildTransfer(forged);
  assert.deepEqual(t.items, [[16, 'Gr60', 12000, 1]]);
  assert.deepEqual(t.tooLong, [9, 10, 11, 12, 13]);
});

test('missing grade: kept in the analysis, never sent, never assumed; explicit assignment only', () => {
  const g = [['Mark', 'Dia', 'Grade', 'Cut length (mm)', 'Qty'], ['a', 16, '', 2000, 5], ['b', 16, 'Gr60', 2000, 2], ['c', 12, '  ', 1000, 3]];
  const r = run(g);
  assert.equal(r.summary.totals.bars, 10);
  assert.deepEqual(r.notForOptimizer, { rows: 2, bars: 8 });
  assert.ok(r.rows.filter(x => !x.gradeKey).every(x => x.warnings.includes('gradeMissing')));
  const t = E.buildTransfer(r.rows);
  assert.deepEqual(t.items, [[16, 'Gr60', 2000, 2]]);
  assert.deepEqual(t.noGrade, { rows: [2, 4], bars: 8 });
  assert.ok(t.items.every(i => i[1] !== ''));
  // an explicit choice by the user, recorded as such
  const a = run(g, { assignGrade: 'grade 80' });
  assert.deepEqual(a.notForOptimizer, { rows: 0, bars: 0 });
  assert.deepEqual(a.rows.map(x => [x.mark, x.grade, x.gradeAssigned]), [['a', 'Gr80', true], ['b', 'Gr60', false], ['c', 'Gr80', true]]);
  assert.ok(a.warnings.some(w => w.code === 'gradeAssigned' && w.count === 2 && w.grade === 'Gr80'));
  assert.deepEqual(E.buildTransfer(a.rows).items, [[12, 'Gr80', 1000, 3], [16, 'Gr60', 2000, 2], [16, 'Gr80', 2000, 5]]);
  // a blank assignment assigns nothing
  assert.deepEqual(run(g, { assignGrade: '  ' }).notForOptimizer, { rows: 2, bars: 8 });
});

test('duplicates: same mark in different members is fine; no member column is flagged; nothing is dropped', () => {
  const withMember = run([['Member', 'Mark', 'Dia', 'Cut length (mm)', 'Qty'], ['B1', '01', 16, 2000, 4], ['B2', '01', 20, 3000, 2]]);
  assert.equal(withMember.warnings.filter(w => /^dup/.test(w.code)).length, 0);
  const noMember = run([['Mark', 'Dia', 'Cut length (mm)', 'Qty'], ['01', 16, 2000, 4], ['01', 20, 3000, 2], ['02', 16, 1000, 1]]);
  const codes = noMember.warnings.map(w => w.code);
  assert.ok(codes.includes('dupNoMember'));
  const c = noMember.warnings.find(w => w.code === 'dupMarkConflict');
  assert.deepEqual([c.scoped, c.member, c.rows], [false, null, [2, 3]]);
  assert.equal(noMember.summary.totals.bars, 7);
  assert.match(TXT.en.warn.dupMarkConflict(c), /Review needed/);
  assert.doesNotMatch(TXT.en.warn.dupMarkConflict(c), /member/);
  assert.match(TXT.en.warn.dupNoMember, /cannot be told apart/);
});

test('XLSX hardening: every hostile fixture is refused with its own reason', async () => {
  const cases = { 'bad-crc.xlsx': 'crc', 'truncated-local.xlsx': 'corrupt', 'bad-offset.xlsx': 'corrupt', 'duplicate-entry.xlsx': 'duplicate',
    'external-rel.xlsx': 'rels', 'traversal-rel.xlsx': 'rels', 'malformed-xml.xlsx': 'xml', 'size-mismatch.xlsx': 'sizeMismatch',
    'method-mismatch.xlsx': 'mismatch' };
  for (const [f, code] of Object.entries(cases)) await rejects(f, code);
  for (const lang of ['en', 'ar', 'zh']) for (const code of new Set(Object.values(cases))) assert.ok(TXT[lang].msg.xlsx[code], lang + ' ' + code);
  // the minimal valid file built the same way is accepted, so the refusals are about the defect
  const { s } = await sheet('valid-minimal.xlsx');
  assert.equal(run(s.rows).summary.totals.bars, 4);
});

test('XLSX helpers: CRC-32, relationship targets, XML well-formedness', () => {
  const I = X._internal;
  assert.equal(I.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.equal(I.resolveTarget('worksheets/sheet1.xml'), 'xl/worksheets/sheet1.xml');
  assert.equal(I.resolveTarget('/xl/worksheets/sheet2.xml'), 'xl/worksheets/sheet2.xml');
  assert.equal(I.resolveTarget('worksheets/../worksheets/s.xml'), 'xl/worksheets/s.xml');
  for (const bad of ['../../etc/passwd.xml', '/etc/x.xml', 'https://x.example/s.xml', 'file:///c:/s.xml', 'worksheets\\s.xml', 'worksheets//s.xml', 'worksheets/s.bin', '../docProps/app.xml'])
    assert.equal(I.resolveTarget(bad), null, bad);
  I.checkXml('<?xml version="1.0"?><a x="1"><b/><c>t &amp; u</c><!-- c --></a>', 't');
  for (const bad of ['<a><b></a>', '<a></a><b/>', '<a>1 < 2</a>', '<a', '<a><b></b>'])
    assert.throws(() => I.checkXml(bad, 't'), e => e.code === 'xml', bad);
});

test('one nominal weight formula: analyzer and optimizer agree for every diameter', () => {
  for (const d of [8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 40]) {
    assert.equal(CutOpt.massPerMetre(d), E.unitWeight(d));
    near(E.unitWeight(d), 0.006165 * d * d, 0);
    const a = run([['Dia', 'Grade', 'Cut length (mm)', 'Qty'], [d, 'Gr60', 12000, 7], [d, 'Gr60', 4000, 9]]);
    const o = CutOpt.optimize({ stockLength: 12000, kerf: 0, items: [{ diameter: d, grade: 'Gr60', length: 12000, qty: 7 }, { diameter: d, grade: 'Gr60', length: 4000, qty: 9 }] });
    near(o.groups[0].weightRequiredKg, a.summary.totals.weightKg, 1e-9, 'd=' + d);
  }
});

/* ==== final corrections: strict boundary on unrounded input ============== */

test('strict 12 m boundary: decided on the value as written, before rounding', () => {
  const cases = [
    ['mm', '12000', true], ['mm', '12000.0001', false], ['mm', '12000.001', false], ['mm', '12000.000000000001', false],
    ['mm', '11999.9999', true], ['mm', 12000, true], ['mm', 12000.0001, false],
    ['m', '12', true], ['m', '12.000', true], ['m', '12.0000001', false], ['m', '12.0000000000001', false],
    ['m', 12, true], ['m', 12.0000001, false]];
  for (const [unit, v, included] of cases) {
    const r = run([['Mark', 'Dia', 'Grade', `Cut length (${unit})`, 'Qty'], ['x', 16, 'Gr60', v, 2]]);
    assert.equal(r.rows.length, included ? 1 : 0, `${v} ${unit}`);
    if (!included) {
      assert.deepEqual(r.issues[0].codes, ['overStock'], `${v} ${unit}`);
      assert.equal(r.summary.totals.bars, 0);
      assert.equal(r.excluded.overStock.bars, 2);
      assert.deepEqual(E.buildTransfer(r.rows).items, []);
    } else {
      assert.ok(r.rows[0].lengthMm <= 12000);
      assert.equal(E.buildTransfer(r.rows).items.length, 1);
    }
  }
});

test('excluded rows keep their exact length for display; rounding happens only for included rows', () => {
  const r = run([['Mark', 'Dia', 'Grade', 'Cut length (mm)', 'Qty'], ['a', 16, 'Gr60', '12000.0001', 1], ['b', 16, 'Gr60', '2350.0004', 1]]);
  assert.equal(r.issues[0].lengthExact, '12000.0001');
  assert.equal(r.rows[0].lengthMm, 2350);                          // rounded to 0.001 mm after the decision
  const m = run([['Dia', 'Grade', 'Length (m)', 'Qty'], [16, 'Gr60', '12.0000001', 1]]);
  assert.equal(m.issues[0].lengthExact, '12000.0001');
});

test('grade assignment needs an explicit, confirmed choice in the page', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'bbs', 'app.js'), 'utf8');
  assert.match(src, /go\.disabled = !\(cb\.checked && v && E\.normGrade\(v\)\.key\)/);   // disabled until confirmed
  assert.match(src, /cb\.checked = false; sync\(\)/);                                    // a new grade needs a new tick
  assert.match(src, /if \(!cb\.checked\) \{ say\(T\.assign\.needConfirm/);
  for (const l of ['en', 'ar', 'zh']) {
    assert.match(TXT[l].assign.scope(3, '12', '4, 5, 9'), /4, 5, 9/);
    assert.ok(TXT[l].assign.confirm(3, 'Gr60').includes('Gr60'));
  }
  assert.match(TXT.en.assign.scope(3, '12', '4'), /ALL 3 rows/);
});
