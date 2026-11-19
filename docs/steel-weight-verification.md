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
- **Length:** in mm or m, chosen explicitly; no longer than one 12 m stock bar.
- **Bars:** a whole number from 1 to 1,000.
- **Measured weight:** more than 0 and up to 100,000 kg.
- **Reference, grade and notes:** optional, cleaned of control characters and length-limited.

**Refused with a reason:** decimal commas (ambiguous), exponents, blanks, and values that only fit the other length unit (over 30 in metres, under 20 in millimetres). Such values are never converted.

**Re-check warning:** a deviation larger than 25% prompts the user to re-check the unit, the bar count and the diameter. It is an input check only, not an acceptance limit, and says nothing about the steel.

## Tolerance

- **No acceptance limit is built in.** No ASTM or other limits are included.
- **User range, optional:** the user may enter a lower limit (≤ 0%) and/or an upper limit (≥ 0%). Each sample is then shown as "inside" or "outside the range you entered". Bounds are inclusive, and the unrounded deviation is used.
- **Never a verdict:** wherever the result appears, it is stated to be only a comparison with the user's numbers. The tool never uses the words compliant, non-compliant, pass or fail.

## Several samples

- **Session table:** every sample keeps its own row with its deviation.
- **Pooling within a diameter:** samples of the same diameter are pooled into a combined deviation (Σ measured vs Σ theoretical), shown next to the lowest and highest individual deviation.
- **Across diameters:** only the total masses are summed. No overall percentage is given, and the page explains why.

## Reports

- **Print / PDF:** a session report, without the input forms.
- **CSV:** per-sample rows, a per-diameter block, the entered range, the formula and the statement. Cells starting with `= + - @ |` (other than plain numbers) are prefixed with `'`.
- **Summary text:** copyable in a textarea or with a button. WhatsApp opens only after a confirmation dialog, and nothing is sent automatically.
- **Statement:** every output says the result is a theoretical comparison, not a mill test certificate (MTC), not a laboratory test and not a certification of steel quality, and that a deviation on its own does not prove non-compliance.

## Tests

`tests/swv.test.js` has 15 tests. They cover every supported diameter against hand values, agreement with the BBS Analyzer and the optimizer, mm and m lengths, several bars, deviation signs, decimal precision, every invalid-input code, non-standard sizes, grade independence, the tolerance rules, the absence of verdict wording, pooling, the CSV and its injection guard, text cleaning, i18n parity and privacy.
