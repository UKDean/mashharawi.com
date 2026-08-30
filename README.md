# mashharawi.com

Personal website of Omar Mashharawi. Commercial and sales professional in the steel industry, working on software, automation, and AI.

Live site: https://mashharawi.com

## Stack

Static, no build step. One HTML file with inline CSS and vanilla JavaScript, plus image assets. Fonts are loaded from Google Fonts.

## Files

| File | Purpose |
|---|---|
| `index.html` | The full site: markup, styles, and scripts |
| `portrait.webp` | Portrait, primary format |
| `portrait.jpg` | Portrait, fallback for older browsers |
| `portrait-small.jpg` | 600px portrait, spare asset |
| `robots.txt` | Crawler rules |
| `sitemap.xml` | Sitemap for search engines |

All asset paths are relative, so every file must stay in the repository root.

## Local preview

```powershell
# from the repository folder
python -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly by double click also works.

## Deployment

Cloudflare Pages, connected to this repository. Every push to `main` publishes automatically. No build command, no output directory (static site).

## Content still to fill

Search `index.html` for `TODO`:

1. `TODO-EMAIL` contact address
2. `TODO-LINKEDIN` LinkedIn profile URL
3. `TODO-PROJECT` featured project name, description, App Store link, screenshots
4. `TODO-PROJECT-2` optional second project card

## Accuracy rule for this repository

No invented content: no education claims, no invented repositories, frameworks, statistics, or App Store numbers. Unverified details stay as placeholders until confirmed.
