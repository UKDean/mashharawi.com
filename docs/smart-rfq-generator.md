# Smart RFQ Generator

A browser-only form that prepares a structured request for quotation (RFQ) for
Al Rajhi Steel reinforcing steel, in English, Arabic (RTL) and Simplified
Chinese. It prepares the request only: no prices, no estimates, no binding
offer, nothing sent or stored automatically.

## Files

| Path | What it is |
|---|---|
| `assets/rfq/rfq.js` | No DOM. Product catalogue, `validate(state, today)`, summary, `makeRef`, `buildText` (the RFQ as text), `waUrl`, `mailtoUrl`, `shortMailto`. Runs in Node for the tests. |
| `assets/rfq/i18n.js` | All text used by the script, preview and exported RFQ, per language: labels, messages, warnings, commercial notes, disclaimer. |
| `assets/rfq/app.js` | The page: product lines, live validation and summary, preview, print, copy, WhatsApp, email. `textContent` only; no storage, no network. |
| `assets/rfq/rfq.css` | Styles and the print stylesheet (only the RFQ document prints). |
| `tools/`, `ar/tools/`, `zh/tools/smart-rfq-generator/index.html` | The three pages. |
| `help/`, `ar/help/`, `zh/help/smart-rfq-generator/` | Help Center guides (anchors used by the tool: `#customer`, `#project`, `#products`, `#commercial`, `#review`). |
| `tests/rfq.test.js` | Catalogue, validation, summary, text, links, pages, safety. |

## Products

| Type | Diameters | Grades | Length | Notes |
|---|---|---|---|---|
| `standard` straight deformed | 10, 12, 14, 16, 18, 20, 25, 32 mm | Grade 60, Grade 80 | 12 m | |
| `epoxy` epoxy-coated | same list | Grade 60, Grade 80 | to be confirmed | every line is marked “availability to be confirmed” |
| `cold8` 8 mm cold-rolled | 8 mm only | Grade 40 only | 6 m | separate category, never mixed with Grade 60/80 |

No 22 mm, no coils, no plain round bars. Nothing is pre-selected; changing the
type clears a diameter or grade that does not apply (with a message) and never
substitutes one. To change the range, edit `PRODUCTS` in `rfq.js` and the
product text in the pages and guides; the tests pin the current range.

## Validation (`validate`)

Errors block the preview; warnings do not.

- Required: company, contact person, phone, project name, project location, delivery schedule, payment terms, at least one product line; per line type, diameter, grade and quantity.
- Email optional, but valid if given. Phone: 7–15 digits; spaces, `+ - ( ) .` allowed; `+` only at the start.
- Quantity: metric tons, digits with a dot, up to 3 decimals, more than 0, at most 100,000 t; a comma is refused (12,5 is ambiguous). Totals use integer kilograms.
- Dates: valid `YYYY-MM-DD`, not before today. Text lengths are limited; at most 50 lines.
- Warnings: duplicate lines (same type, diameter, grade and line date; flagged, never merged), epoxy lines (availability to be confirmed), total below 30 t (transport note). No minimum quantity is enforced.

## Summary

The overall total (all valid lines) is shown on its own. The breakdown is
grouped by product type, diameter and grade, so different grades or products are
never added into one figure. Incomplete lines are not counted and are reported.

## Preview, export and sharing

- **Preview:** shown only for a valid form. It contains the local reference `RFQ-YYYYMMDD-XXXXX` (random, identification only; the page says it is not an Al Rajhi Steel quotation number), the date, customer, project, product table with total, breakdown, delivery, payment preference, notes, the commercial notes and the disclaimer.
- **Print / PDF:** `window.print()` with the print stylesheet; only the document prints.
- **Copy:** the plain-text RFQ in the page language.
- **WhatsApp and email:** enabled only after the preview, when the form has not changed since, and after the user ticks “I have reviewed this RFQ”. They open `https://wa.me/<number>?text=…` or `mailto:<address>?subject=…&body=…` addressed to the sales contact in `Rfq.CONTACT`; the user sends from their own app. Email links longer than 1,800 characters (most Arabic and Chinese RFQs, once encoded) are not used: the full text is copied and the email opens with the subject and a note to paste it. WhatsApp text is limited to 4,000 characters.

## Privacy and safety

- No backend, API, account, upload, analytics or storage. No `<form>` element and no `name` on text fields, so nothing can be submitted; all fields have `autocomplete="off"`, and a page restored from the back/forward cache is cleared. Refreshing or closing the tab ends the session.
- All user text is written with `textContent` or as a field value; no HTML insertion. The tests scan the code for storage, network and HTML-insertion APIs.
- The page has no speculation-rules prefetching.
