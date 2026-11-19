# Construction Dictionary

A trilingual (English, Arabic, Simplified Chinese) reference of construction,
reinforcing-steel and site terms. Static pages, one local JSON file, and a
small script. No backend, no API, no accounts, no tracking, no storage.

## Files

| Path | What it is |
|---|---|
| `assets/construction-dictionary/terms.json` | The data: categories and terms. The only file to edit when adding terms. |
| `assets/construction-dictionary/dictionary.js` | No DOM. Normalisation, search, highlighting, copy text and `validate(data)`. Loaded in the browser and by the tests. |
| `assets/construction-dictionary/i18n.js` | Messages written by the script (counts, copy feedback, errors) in EN/AR/ZH. |
| `assets/construction-dictionary/app.js` | The page: loads `terms.json`, search box, category filters, highlighting, copy buttons, related-term links. |
| `assets/construction-dictionary/dict.css` | Styles; uses the site variables and the shared `.calc`, `.calc-chip`, `.calc-btn` components. |
| `tools/`, `ar/tools/`, `zh/tools/construction-dictionary/index.html` | The three pages. Every card is in the HTML, so the list is readable and indexable without JavaScript. |
| `help/`, `ar/help/`, `zh/help/construction-dictionary/` | The Help Center guide. |
| `scripts/validate_dictionary.js` | Command-line validation. |
| `scripts/build_dictionary.py` | Rewrites the generated parts of the three pages (cards, category buttons, count, DefinedTermSet data) from `terms.json`, between `<!--cd:…-->` markers. `--check` reports pages that are out of date. Standard library only. |
| `tests/dictionary.test.js` | Data, search and page tests. |

## Data format

```json
{
  "id": "lap-splice",
  "category": "structural",
  "term": { "en": "Lap splice", "ar": "وصلة التراكب", "zh": "搭接" },
  "definition": { "en": "…", "ar": "…", "zh": "…" },
  "synonyms": { "en": ["lap", "lap length"], "ar": ["طول الركوب"], "zh": ["搭接长度"] },
  "related": ["development-length", "mechanical-coupler"],
  "abbreviation": "…",                       // optional
  "example": { "en": "…", "ar": "…", "zh": "…" },   // optional, all three languages
  "notes": { "en": "…", "ar": "…", "zh": "…" },     // optional, all three languages
  "review": ["ar"]                           // optional: languages whose term is not confirmed
}
```

- `id`: lower-case words joined by hyphens; never change an existing id, it is part of the URL (`#t-lap-splice`).
- `category`: one of the ids in `categories`.
- `synonyms`: arrays, may be empty, but no empty strings, no repeats, and not the term itself.
- `related`: ids of other entries; no self-references, no repeats.
- `review`: use it whenever a translation is uncertain or regional. The page then shows “To be reviewed” next to that language. Say why in `notes` where it helps.

## Adding terms safely

1. Check the term is not already there: search the page in all three languages, including synonyms. If it exists under another name, add a synonym instead of a new entry.
2. Use the established engineering term in each language, not a word-for-word translation. Put site and regional names (for example جسر / كمرة, 螺纹钢) in `synonyms`.
3. Write a short working definition in each language. Do not quote standards, do not invent numeric limits, and do not state a code requirement unless you are sure of it.
4. If any translation is uncertain, add its language to `review`.
5. Run `node scripts/validate_dictionary.js`.
6. Run `python3 scripts/build_dictionary.py` so the static cards match the data (the tests compare them card by card), then `python3 scripts/build_notes.py` from a full clone to refresh the sitemap dates.
7. Run `node --test tests/*.test.js`.
8. Counts appear in the page descriptions, the tools index, `llms.txt` and the Help Center guides; update them if the number of terms changes (the tests check the page descriptions).

## Validation rules (`validate(data)`)

Errors (the tests and the script fail):
- missing or duplicate ids, ids in the wrong format, unknown fields;
- unknown category, duplicate category ids, missing category names;
- missing or untrimmed term or definition in any language;
- synonyms that are not arrays, empty strings, repeats, or the term itself;
- related ids that do not exist, point to the entry itself or repeat;
- `example` or `notes` missing a language; `review` with an unknown language;
- **duplicates**: two entries with the same term in the same language (after normalisation), or a synonym that is another entry's term;
- a synonym shared by two entries, unless it is recorded in `sharedSynonyms` (`{ "lang", "text", "reason" }`) after review. Unused `sharedSynonyms` entries are also errors.

Duplicates are never removed automatically. When the validator reports one, decide whether the two records are the same concept (merge them and keep the other name as a synonym) or genuinely different concepts that share a word (keep both and make the synonym specific, or record it in `sharedSynonyms` with the reason). Examples resolved this way in the initial data: “الهبوط” is the Arabic for both settlement and concrete slump, so it stays the term for settlement and slump keeps “هبوط الخرسانة”; “test certificate” stays with the mill test certificate and not the laboratory test report.

## Terminology choices (review of PR #17)

- Synonyms must name the same thing. Left out on purpose: “حديد” alone (any iron or steel), “طلب شراء” (the internal purchase request, not the order), “waybill” and “delivery order” (different documents), “workability” for slump (slump is one measure of it), “mandrel diameter” for bend diameter (related, not the same), “weight deviation” for mass tolerance (a measured difference, not a limit), and example grades such as Grade 60 as synonyms of “steel grade”.
- Regional or site words (جسر / كمرة, الدليفري نوت, بسكوت) are kept as synonyms, and the notes say where they are used instead of presenting them as standard.
- Where a requirement depends on a standard or the project specification (mass tolerance, development length, bend diameter, carbon equivalent, slump range, grades), the definition says so and does not give a general value.
- Chinese “consultant” is the general 工程咨询单位, with 监理单位 (construction supervision) and 设计单位 (design) as separate role names; they are not interchangeable.

## Search

- Normalisation: NFKC, lower case; Arabic diacritics, tatweel and direction marks removed; أ إ آ ٱ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي; Arabic-Indic digits → 0–9; punctuation → space.
- Query words are ANDed. Arabic words also match without a leading ال (or وال، بال، كال، فال).
- Scores: term (exact 100, start 80, word 65, inside 45) > synonyms and abbreviation (exact 90, start 55, word 45, inside 30) > definitions in any language (whole words for Latin and Arabic, substrings for Chinese). A full-phrase match adds a bonus.
- Results are sorted by score, then alphabetically in the page language. With no query, entries are grouped by category.
- Highlighting maps matches back to the original text, so marks land on the right characters even when diacritics were removed.

## Privacy and safety

- The page fetches only `terms.json` from this site. No external API, no analytics, no storage API, no cookies, no URL state for queries (a test checks the code).
- All dictionary text is written with `textContent` or as escaped HTML from the generator; nothing is inserted as HTML at run time.
- If `terms.json` cannot load, the search controls are hidden and the full static list stays readable.
