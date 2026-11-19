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
- the length is missing, not a number, zero or negative, or written with a comma (ambiguous);
- **the cut length is above 12,000 mm** (one 12 m stock bar). The reason shown is "Cut length exceeds the 12 m stock bar limit." 12,000 mm is included and 12,000.001 mm is excluded (lengths are held to 0.001 mm). These rows are in no total or summary and never reach the optimizer; their bars, length and theoretical weight are shown separately;
- the value only fits the other unit: more than 100 in a metres column, or less than 20 in a millimetres column;
- the number of bars is missing, not a whole number, or outside 1–1,000,000;
- members × bars in each contradicts the total;
- a used cell holds a spreadsheet error;
- it has neither a diameter nor a length (titles, notes, subtotals).

**A warning is shown, and the row is still counted, when:**
- a bar mark repeats within the same member, when there is a member column (the same mark in another member is normal). Identical and conflicting repeats get different warnings, both marked "review needed". Without a member column, a separate warning says uniqueness cannot be established. Rows and quantities are always kept;
- there is more than one grade, a grade is missing, or one grade is written in several ways;
- a diameter is non-standard;
- a value comes from a formula (Excel's saved result is used; no formula is run);
- the sheet's own weight or total length differs from the theoretical value (only checked when that column's unit is known).

## Three row groups

The results always show three groups:
1. **Included in the analysis.** These rows make up every total.
2. **Excluded from the calculation.** Each row is listed with its row number, mark, diameter, cut length, bars and reason. Over-length quantities are shown apart from the totals.
3. **Included, but not sent to the cutting optimizer.** These are rows with no grade. Grade 60 or 80 is never assumed. The user can explicitly assign a grade to these rows; the assignment is shown as theirs, and only then are the rows sent.

## Arithmetic

- Unit weight: `0.006165 × d²` kg/m, as specified for this tool.
- Total length: `cut length × bars`.
- Weight: `unit weight × total length`.
- Lengths are stored in mm, rounded to 0.001 mm to remove conversion noise. Totals are summed unrounded and rounded only for display.
- The cutting optimizer uses the same 0.006165 × d² constant, and a regression test compares the two tools for every diameter.

## Hand-off to the cutting optimizer

1. Valid rows are grouped by (diameter, normalised grade, length rounded to whole mm), and the bars are summed. Diameters and grades are never merged.
2. Rows over 12 m are already excluded by the analysis, and the transfer refuses any row over 12,000 mm again as a second check. Rows without a grade are held back, and their count and bars are shown. Lengths changed by rounding are counted.
3. The payload is `{v:1, items:[[d, grade, mm, qty], …]}` as base64url in the URL fragment (`#bbs=`). Fragments are never sent to the server, and nothing is stored.
4. The optimizer opens in a new tab, so the original schedule stays in the analyzer tab. The optimizer validates every item and rejects the whole payload if any item is invalid. It then removes the fragment from the address bar and history, fills the cut list, and waits for the user to review it and press Optimise. The stock length stays at its 12 m default.

## Privacy and security

- **No network or storage:** the file is read with FileReader in the tab. No `fetch`, upload, storage API, analytics or account is involved; a test scans the code for these.
- **Untrusted content:** cell text is written with `textContent` only.
- **No macros or DTDs:** macros are never opened. XML containing a DTD or entity declarations is refused.
- **Size limits:** 25 MB per file, 60 MB inflated per part (enforced while inflating, so a zip bomb that lies about its size is also stopped), 100,000 rows and 200 columns.
- **ZIP integrity:**
  - The central directory and local headers are bounds-checked.
  - Local headers must match the central directory: name, flags, method, CRC and sizes.
  - Refused: duplicate names, overlapping entries, ZIP64, encryption, split archives, unknown flags, and any method other than stored or deflate.
  - Every part is checked against its CRC-32 and its declared size; inflation stops as soon as it passes that size.
  - Total inflated data is capped at 120 MB, and entries at 2,000.
- **Relationship targets:** a sheet must be a part under `xl/`. External targets, URI schemes, backslashes and `..` that would leave `xl/` are refused.
- **XML:** each part is checked for well-formedness (balanced tags, one root, no stray `<`); a truncated or edited part is refused. A cell reference that appears twice is refused; a shared-string index out of range is treated as an error cell.
- **CSV export:** cells starting with `= + - @ |` (other than plain numbers) are prefixed with `'`.

## Accounts

Not implemented. The tool works without signing in. State is kept in one `state` object in `app.js`, and all logic is in `engine.js`, so a later account feature could save or load a schedule without changing the calculations.

## Tests

`node --test tests/*.test.js`: `tests/bbs.test.js` (37 tests). The workbook fixtures in `tests/fixtures/bbs/` were written by openpyxl, plus hand-built hostile files. The expected totals in `expected.json` were computed independently in Python with decimal arithmetic.
