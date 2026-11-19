# BBS Analyzer

Pages: `/tools/bbs-analyzer/` (EN), `/ar/tools/bbs-analyzer/` (AR, RTL), `/zh/bbs-analyzer/` (ZH).

## Files

| File | Role |
|---|---|
| `assets/bbs/xlsx.js` | Read-only XLSX reader, no dependency. ZIP central directory + `DecompressionStream('deflate-raw')` (built into current browsers and Node 18+), regex XML reading of shared strings, inline strings, numbers, booleans, errors and cached formula results. |
| `assets/bbs/engine.js` | No DOM. CSV/TSV parsing, header recognition (EN/AR/ZH), validation, weights, summaries, hand-off grouping and encoding, safe CSV export. |
| `assets/bbs/i18n.js` | All interface text in three languages, including the sample schedule. Tested for identical keys. |
| `assets/bbs/app.js` | The page: file, paste, manual entry, column mapping, results, exports, hand-off. |
| `assets/bbs/bbs.css` | Styles on top of `site.css` and `assets/cutopt/cutopt.css`. |
| `assets/cutopt/app.js` | Optimizer side of the hand-off (`fromAnalyzer`). The optimizer engine is unchanged. |

## Dependencies

None added. SheetJS was considered and rejected. It is several hundred kB, its npm package is no longer updated, and the tool needs only cell values. The built-in reader is about 250 lines. Old `.xls` (BIFF) files are not supported; the page asks for `.xlsx` or CSV.

## Input and mapping

- **Inputs:** `.xlsx` / `.xlsm`, CSV / TSV, a range pasted from Excel, or manual lines.
- **Workbooks:** you choose the sheet.
- **Header detection:** the analyzer scans the first 30 rows for a header with diameter, cut length and a quantity. The quantity is either a total column, or "no. of members" and "no. in each" together.
- **Column names:** recognised in English, Arabic and Chinese. Every field can be remapped by hand, and the header row can be changed.
- **Length unit:** taken from the header, for example `Cut length (mm)`, `الطول (م)` or `下料长度(毫米)`. If the header has no unit, the user must choose one. Analysis does not run until a unit is set.

## Validation (never guesses)

**A row is excluded, with a reason, when:**
- the diameter is missing, unreadable, outside 4–60 mm, or a US `#` size;
- the length is missing, not a number, zero or negative, longer than 100 m, or written with a comma (ambiguous);
- the value only fits the other unit: more than 100 in a metres column, or less than 20 in a millimetres column;
- the number of bars is missing, not a whole number, or outside 1–1,000,000;
- members × bars in each contradicts the total;
- a used cell holds a spreadsheet error;
- it has neither a diameter nor a length (titles, notes, subtotals).

**A warning is shown, and the row is still counted, when:**
- a bar mark repeats (scoped by member when there is a member column), with a separate warning when the repeated rows conflict;
- there is more than one grade, a grade is missing, or one grade is written in several ways;
- a diameter is non-standard;
- a bar is longer than 12 m;
- a value comes from a formula (Excel's saved result is used; no formula is run);
- the sheet's own weight or total length differs from the theoretical value (only checked when that column's unit is known).

## Arithmetic

- Unit weight: `0.006165 × d²` kg/m, as specified for this tool.
- Total length: `cut length × bars`.
- Weight: `unit weight × total length`.
- Lengths are stored in mm, rounded to 0.001 mm to remove conversion noise. Totals are summed unrounded and rounded only for display.
- The cutting optimizer uses π/4 × 7850 / 10⁶ = 0.0061654…, which differs by 0.006 %. Each tool shows its own formula.

## Hand-off to the cutting optimizer

1. Valid rows are grouped by (diameter, normalised grade, length rounded to whole mm), and the bars are summed. Diameters and grades are never merged.
2. Rows longer than 12 m are left out and counted. Lengths changed by rounding are counted. Both counts are shown before sending.
3. The payload is `{v:1, items:[[d, grade, mm, qty], …]}` as base64url in the URL fragment (`#bbs=`). Fragments are never sent to the server, and nothing is stored.
4. The optimizer opens in a new tab, so the original schedule stays in the analyzer tab. The optimizer validates every item and rejects the whole payload if any item is invalid. It then removes the fragment from the address bar and history, fills the cut list, and waits for the user to review it and press Optimise. The stock length stays at its 12 m default.

## Privacy and security

- **No network or storage:** the file is read with FileReader in the tab. No `fetch`, upload, storage API, analytics or account is involved; a test scans the code for these.
- **Untrusted content:** cell text is written with `textContent` only.
- **No macros or DTDs:** macros are never opened. XML containing a DTD or entity declarations is refused.
- **Size limits:** 25 MB per file, 60 MB inflated per part (enforced while inflating, so a zip bomb that lies about its size is also stopped), 100,000 rows and 200 columns.
- **Refused formats:** ZIP64, encrypted and split archives are refused with a message.
- **CSV export:** cells starting with `= + - @ |` (other than plain numbers) are prefixed with `'`.

## Accounts

Not implemented. The tool works without signing in. State is kept in one `state` object in `app.js`, and all logic is in `engine.js`, so a later account feature could save or load a schedule without changing the calculations.

## Tests

`node --test tests/*.test.js`: `tests/bbs.test.js` (29 tests). The workbook fixtures in `tests/fixtures/bbs/` were written by openpyxl, plus hand-built hostile files. The expected totals in `expected.json` were computed independently in Python with decimal arithmetic.
