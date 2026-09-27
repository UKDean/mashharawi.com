# mashharawi.com

Personal website of Omar Mashharawi. Commercial and sales professional in the steel industry, working on software, automation, and AI.

Live site: https://mashharawi.com

## Stack

Static site, no build step for the pages themselves. Hand-written HTML, a shared stylesheet and vanilla JavaScript in `assets/`, fonts from Google Fonts. English at the root, Arabic under `ar/`.

## Layout

| Path | Purpose |
|---|---|
| `index.html`, `ar/index.html` | Home page, English and Arabic |
| `tools/`, `ar/tools/` | Tools index and the in-browser calculators: `steel-sections`, `rebar-weight`, plus `openpdfkit` |
| `contract-check/` | Internal contract review tool |
| `steelcalc/` | Support and privacy pages for the Steel Section Calculator iOS app, plus its screenshots in `shots/` |
| `tubes/`, `crossword/` | Support and privacy pages for the Tubes and Arabic crossword apps |
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
