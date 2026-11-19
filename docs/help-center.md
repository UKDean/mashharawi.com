# Help Center

Static, multilingual help pages for the free rebar tools. No framework, no
backend, no tracking. The only script on these pages is the shared `site.js`.

## URLs

| Page | English | Arabic (RTL) | Chinese |
|---|---|---|---|
| Help Center | `/help/` | `/ar/help/` | `/zh/help/` |
| Cutting Optimizer guide | `/help/cutting-optimizer/` | `/ar/help/cutting-optimizer/` | `/zh/help/cutting-optimizer/` |
| BBS Analyzer guide | `/help/bbs-analyzer/` | `/ar/help/bbs-analyzer/` | `/zh/help/bbs-analyzer/` |
| Steel Weight Verification guide | `/help/steel-weight-verification/` | `/ar/help/steel-weight-verification/` | `/zh/help/steel-weight-verification/` |

Each language is a separate page with its own `lang`/`dir`, canonical URL and
the same reciprocal `hreflang` set (`en`, `ar`, `zh-Hans`, `x-default` → English).
The language links in the header go to the equivalent help page, not to the
home page.

## Structure

The index has seven sections, each with a stable anchor:
`#getting-started`, `#tool-guides`, `#tutorials`, `#examples`, `#formulas`,
`#faq`, `#troubleshooting`.

Every tool guide covers what the tool does (`#what`), when to use it (`#when`),
the steps (`#steps`), a worked example with real numbers (`#example`), how to
read the results (`#results`), common mistakes (`#mistakes`), limitations
(`#limits`) and related links (`#related`). Tool-specific anchors:

- Cutting Optimizer: `#settings`, `#cut-list`, `#paste`, `#run`
- BBS Analyzer: `#import`, `#columns`, `#interpretation`, `#excluded`,
  `#twelve-metres`, `#grades`, `#send`
- Steel Weight Verification: `#measure`, `#units`, `#tolerance`, `#add`,
  `#compliance`

Anchors are part of the public URL. Do not rename them: the in-tool help links
and the tests depend on them.

## In-tool help

The Cutting Optimizer, BBS Analyzer and Steel Weight Verification pages (all
three languages) have:

- a "How to use this tool" link at the top of the calculator;
- small "Help" links beside the parts that need explaining: saw kerf, reusable
  offcut and paste format (optimizer); column mapping, excluded rows, missing
  grade, 12 m rule and sending to the optimizer (BBS); measuring the sample,
  the acceptance range and reading the results (weight verification).

All of them open the guide **in the same language, in a new tab**, so the
work in the tool is not lost.

## Numbers

All worked examples are computed by the tool engines, and
`tests/help.test.js` re-computes them and checks they appear on every language
version. Nominal mass is `0.006165 × d²` kg/m everywhere. If an engine changes
and an example no longer matches, the test fails.

## Tests

`node --test tests/*.test.js`. `tests/help.test.js` checks: the 12 pages, language
and direction, canonical and hreflang reciprocity, header language switching,
no mixed languages, required sections and anchors, every internal link and
anchor, the in-tool help links, no extra scripts or tracking, the example
numbers, the formula table, and the sitemap entries.

## Sitemap

`scripts/build_notes.py` lists the help pages in `PAIRS`, `ZH_TWINS` and
`ZH_PAGES`. Run it from a full (non-shallow) clone, otherwise `lastmod` values
are lost.
