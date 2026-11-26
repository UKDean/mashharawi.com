# mashharawi.com

Personal website of Omar Mashharawi. Commercial and sales professional in the steel industry, working on software, automation, and AI.

Live site: https://mashharawi.com

## Stack

Static site, no build step for the pages themselves. Hand-written HTML, a shared stylesheet and vanilla JavaScript in `assets/`, fonts from Google Fonts. English at the root, Arabic under `ar/`.

## Layout

| Path | Purpose |
|---|---|
| `index.html`, `ar/index.html` | Home page, English and Arabic |
| `tools/`, `ar/tools/` | Tools index and the in-browser calculators: `steel-sections`, `rebar-weight`, `cutting-optimizer`, `bbs-analyzer`, `steel-weight-verification`, plus `openpdfkit` |
| `assets/cutopt/` | Rebar cutting optimizer: `engine.js` (calculation only, no DOM, tested), `app.js` (page), `cutopt.css`. Chinese page at `zh/rebar-cutting-optimizer/` |
| `assets/bbs/` | BBS Analyzer: `xlsx.js` (dependency-free read-only XLSX reader), `engine.js` (parsing, mapping, validation, weights, optimizer hand-off), `i18n.js` (EN/AR/ZH text), `app.js` (page), `bbs.css`. Chinese page at `zh/bbs-analyzer/`. See `docs/bbs-analyzer.md` |
| `assets/swv/` | Steel weight verification: `engine.js` (no DOM; nominal vs measured, deviation, user range comparison, per-diameter pooling, safe CSV), `i18n.js`, `app.js`, `swv.css`. Chinese page at `zh/steel-weight-verification/`. See `docs/steel-weight-verification.md` |
| `assets/construction-dictionary/` | Construction dictionary: `terms.json` (the data: categories and terms in EN/AR/ZH), `dictionary.js` (no DOM; normalisation, search, highlighting, data validation), `i18n.js`, `app.js`, `dict.css`. Pages at `tools/`, `ar/tools/` and `zh/tools/construction-dictionary/`. See `docs/construction-dictionary.md`; validate with `node scripts/validate_dictionary.js` |
| `assets/rfq/` | Smart RFQ generator: `rfq.js` (no DOM; product catalogue, validation, summary, reference, RFQ text, WhatsApp and mailto links), `i18n.js` (EN/AR/ZH), `app.js` (form, preview, print, copy, share; no storage), `rfq.css` (with print stylesheet). Pages at `tools/`, `ar/tools/` and `zh/tools/smart-rfq-generator/`. See `docs/smart-rfq-generator.md` |
| `help/`, `ar/help/`, `zh/help/` | Help Center: index (getting started, tutorials, examples, formulas, FAQ, troubleshooting) and one guide per tool. Static HTML, styles in `assets/help/help.css`, no script |
| `tests/` | Engine tests, run with `node --test tests/*.test.js` (Node 18+, no dependencies). The `Tests` workflow runs them on every PR |
| `contract-check/` | Internal contract review tool |
| `steelcalc/` | Support and privacy pages for the Steel Section Calculator iOS app, plus its screenshots in `shots/` |
| `tubes/`, `crossword/` | Support and privacy pages for the Tubes and Arabic crossword apps |
| `kavro/`, `ar/kavro/` | KAVRO product, support and legal pages. Generated outside this repository; don't edit them by hand |
| `notes/` | Source Markdown for the writing section |
| `writing/`, `feed.xml`, `sitemap.xml` | Generated from `notes/` by `scripts/build_notes.py`. Edit the Markdown, not the output |
| `assets/` | `site.css`, scripts, logo, and `data/` for the calculators |
| `scripts/build_sections.py` | Builds `assets/data/steel-sections.json` from the SteelCalc app's tables |
| `motion/` | Remotion project for motion assets |
| `_redirects` | Cloudflare Pages redirects |

App Store listings point at the support and privacy URLs under `steelcalc/`, `tubes/` and `crossword/`, so those paths must not move.

## Apps

- Steel Section Calculator (iOS): https://apps.apple.com/us/app/steel-section-calculator/id6815107544

## Local preview

```bash
# from the repository folder
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deployment

Cloudflare Pages, connected to this repository. Every push to `main` publishes automatically. No build command, no output directory. The `build-notes` GitHub workflow runs `scripts/build_notes.py`.

## Accuracy rule for this repository

No invented content: no education claims, no invented repositories, frameworks, statistics, or App Store numbers. Unverified details stay as placeholders until confirmed.
