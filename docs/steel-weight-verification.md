# Steel Weight Verification

Pages: `/tools/steel-weight-verification/` (EN), `/ar/tools/steel-weight-verification/` (AR, RTL), `/zh/steel-weight-verification/` (ZH).

## Files

| File | Role |
|---|---|
| `assets/swv/engine.js` | No DOM. Input validation, nominal and theoretical weight, difference, deviation, comparison with the user's range, pooling per diameter, safe CSV. |
| `assets/swv/i18n.js` | Interface text in EN/AR/ZH. The tests check that the three have identical keys. |
| `assets/swv/app.js` | The page: live result, visual comparison, session table, CSV, print, copy and WhatsApp. |
| `assets/swv/swv.css` | Styles on top of `site.css` and `assets/cutopt/cutopt.css`. |

No dependencies. No backend, accounts, uploads or storage: the session lives in memory in the tab.

## Calculations

- **Nominal unit weight** = 0.006165 × d² kg/m, with d the nominal diameter in mm. This is the same constant as the cutting optimizer and the BBS Analyzer; a test checks all three tools agree. Grade does not enter the formula, because Grade 60 and Grade 80 have the same nominal weight per metre.
- **Theoretical weight** = unit weight × length (m) × number of bars.
- **Difference** = measured − theoretical (kg).
- **Deviation %** = (measured − theoretical) ÷ theoretical × 100. It is positive when the sample is heavier than nominal and negative when it is lighter.
- All values are computed from the inputs as entered and rounded only on screen and in the CSV text.

## Inputs and validation

**Fields:**
- **Diameter:** 4–60 mm. The chips offer Al Rajhi Steel's sizes (10, 12, 14, 16, 18, 20, 25, 32 mm). Any other size is calculated and marked non-standard.
- **Length:** any positive value in mm or m. The unit is chosen explicitly and never inferred or changed. The only limit is one 12 m stock bar: anything above 12,000 mm is refused. The decision is made exactly on the typed digits, so 12 m and 12,000 mm are accepted while 12.000001 m and 12,000.001 mm are refused. Short samples (12, 19, 20, 30 mm) are accepted.
- **Bars:** a whole number from 1 to 1,000.
- **Measured weight:** more than 0 and up to 100,000 kg.
- **Reference, grade and notes:** optional, cleaned of control characters and length-limited.

**Refused with a reason:** decimal commas (ambiguous), exponents, blanks, zero or negative values, fractional bar counts, and lengths over 12,000 mm.

**Input check:** a deviation larger than 25% shows a note headed "Input check" asking the user to re-check the length unit, the bar count and the diameter. In every language the note says it is not an acceptance limit and says nothing about the steel's quality. It is styled as a neutral note, not in the amber or red used for warnings.

## Tolerance

- **No acceptance limit is built in.** No ASTM or other limits are included.
- **User range, optional:** the user may enter a lower limit (≤ 0%) and/or an upper limit (≥ 0%). Each sample is then shown as "inside" or "outside the range you entered". Bounds are inclusive, and the unrounded deviation is used.
- **Never a verdict:** wherever the result appears, it is stated to be only a comparison with the user's numbers. The tool never uses the words compliant, non-compliant, pass or fail.

## Several samples

- **Session table:** every sample keeps its own row with its deviation.
- **Individual sample deviation:** each row's own deviation, labelled "Sample deviation %".
- **Pooled deviation, same nominal diameter only:** (Σ measured − Σ theoretical) ÷ Σ theoretical × 100. It is not the average of the sample percentages. The lowest and highest individual sample deviations are shown beside it.
- **Total masses across all samples:** theoretical, measured and difference in kg only. No percentage is ever calculated across different diameters.
- These three are labelled separately in the page, the CSV, the printed report and the copied / WhatsApp summary.

## Reports

- **Print / PDF:** a session report, without the input forms.
- **CSV:** per-sample rows, a per-diameter block, the entered range, the formula and the statement. Cells starting with `= + - @ |` (other than plain numbers) are prefixed with `'`.
- **Summary text:** copyable in a textarea or with a button. WhatsApp opens only after a confirmation dialog, and nothing is sent automatically.
- **Statement:** the CSV, the printed report (the disclaimer block is never hidden in print) and the copied / WhatsApp summary each state, in every language, that the result is a theoretical comparison, not an MTC, not a laboratory test and not a certification, and that a deviation alone does not prove non-compliance. Tests check each statement in each output and language.

## Tests

`tests/swv.test.js` has 21 tests. They cover every supported diameter against hand values, agreement with the BBS Analyzer and the optimizer, mm and m lengths, several bars, deviation signs, decimal precision, every invalid-input code, non-standard sizes, grade independence, the tolerance rules, the absence of verdict wording, pooling, the CSV and its injection guard, text cleaning, i18n parity and privacy.

## Sitemap

`scripts/build_notes.py` lists the three URLs (`PAIRS` for EN/AR, `ZH_TWINS` and `ZH_PAGES` for ZH).

The committed `sitemap.xml` includes them without a `lastmod`, because a shallow clone cannot date them. After merge, the `build-notes` workflow regenerates the sitemap from full history and adds the dates.

This was checked by merging into a copy of `main` with full history and running the script. All 60 URLs were kept, the hreflang sets were unchanged, and the only differences were the three new `lastmod` lines.
