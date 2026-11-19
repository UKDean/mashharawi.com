#!/usr/bin/env node
/* Validate assets/construction-dictionary/terms.json.
   Usage: node scripts/validate_dictionary.js [path/to/terms.json]
   Exits with code 1 if there are errors. Prints reviewed shared synonyms
   as notes, and a summary of terms per category and translations under
   review. The same checks run in tests/dictionary.test.js. */
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('../assets/construction-dictionary/dictionary.js');

const file = process.argv[2] || path.join(__dirname, '..', 'assets', 'construction-dictionary', 'terms.json');
let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error('Cannot read ' + file + ': ' + e.message); process.exit(1); }

const { errors, warnings } = D.validate(data);
for (const w of warnings) console.log('note: ' + w);
if (errors.length) {
  for (const e of errors) console.error('error: ' + e);
  console.error(errors.length + ' error(s) in ' + file);
  process.exit(1);
}
const per = {};
for (const t of data.terms) per[t.category] = (per[t.category] || 0) + 1;
console.log('OK: ' + data.terms.length + ' terms in ' + data.categories.length + ' categories');
for (const c of data.categories) console.log('  ' + c.id.padEnd(12) + String(per[c.id] || 0).padStart(4) + '  ' + c.name.en);
const review = data.terms.filter(t => t.review);
console.log('Translations marked for review: ' + review.length + (review.length ? ' (' + review.map(t => t.id + ':' + t.review.join('+')).join(', ') + ')' : ''));
