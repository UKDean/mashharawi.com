/* Construction Dictionary: search, highlighting and data validation.
   No DOM, no network: the page passes in the parsed terms.json. Runs the
   same in the browser (window.CDict) and in Node (require) for the tests.

   Search model
   - Text is normalised before comparing: Unicode NFKC, lower case,
     Arabic diacritics and tatweel removed, أ إ آ ٱ -> ا, ى -> ي, ة -> ه,
     ؤ -> و, ئ -> ي, Arabic-Indic digits -> 0-9, punctuation -> space.
   - The query is split on spaces; every word must match somewhere in the
     entry (AND). Arabic words also match without a leading "ال".
   - Chinese has no spaces, so a Chinese word matches as a substring.
   - Fields are weighted: the term itself, then synonyms and abbreviation,
     then the definitions (all three languages). Results are ordered by
     score, then alphabetically in the page language. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CDict = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LANGS = ['en', 'ar', 'zh'];
  var MAX_QUERY = 100;

  /* ---- normalisation ------------------------------------------------------ */
  var AR_DROP = /[ً-ٰٟـۖ-ۭ]/;      // harakat, superscript alef, tatweel, Quranic marks
  var AR_MAP = { 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي' };
  var BIDI = /[​-‏‪-‮⁦-⁩﻿]/;    // direction marks are invisible
  var SEP = /[\s　.,;:!?'"’‘“”«»()\[\]{}<>\/\\|\-–—_·•、，。；：！？（）【】《》「」+*&#%=~^`@$€£،؛؟]/;

  function normChar(ch) {
    if (AR_DROP.test(ch) || BIDI.test(ch)) return '';
    var code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);    // ٠-٩
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);    // ۰-۹
    if (AR_MAP[ch]) return AR_MAP[ch];
    if (SEP.test(ch)) return ' ';
    return ch.normalize('NFKC').toLowerCase();
  }

  /* Normalised text plus, for each output character, the index of the
     source character it came from (for highlighting). */
  function normMap(s) {
    s = String(s == null ? '' : s);
    var out = '', map = [];
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      var c = s.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) { ch = s.slice(i, i + 2); }
      var n = normChar(ch);
      for (var j = 0; j < n.length; j++) {
        if (n[j] === ' ' && (out === '' || out[out.length - 1] === ' ')) continue;   // collapse spaces
        out += n[j]; map.push(i);
      }
      if (ch.length === 2) i++;
    }
    if (out[out.length - 1] === ' ') { out = out.slice(0, -1); map.pop(); }
    return { text: out, map: map };
  }
  function norm(s) { return normMap(s).text; }

  var HAN = /[㐀-鿿豈-﫿]/;
  var ARABIC = /[؀-ۿ]/;

  /* Query words, each with the forms it may match. */
  function tokens(query) {
    var q = norm(String(query == null ? '' : query).slice(0, MAX_QUERY));
    if (!q) return [];
    return q.split(' ').filter(Boolean).map(function (w) {
      var forms = [w];
      if (ARABIC.test(w) && w.length > 3 && w.indexOf('ال') === 0) forms.push(w.slice(2));
      if (ARABIC.test(w) && w.length > 3 && /^(وال|بال|كال|فال)/.test(w)) forms.push(w.slice(3));
      return { word: w, forms: forms, han: HAN.test(w) };
    });
  }

  /* ---- index ---------------------------------------------------------------- */
  function buildIndex(data) {
    var cats = {};
    (data.categories || []).forEach(function (c, i) { cats[c.id] = i; });
    var entries = (data.terms || []).map(function (t, i) {
      var f = { term: [], syn: [], def: [] };
      LANGS.forEach(function (l) {
        f.term.push(norm(t.term[l]));
        (t.synonyms[l] || []).forEach(function (s) { f.syn.push(norm(s)); });
        f.def.push(norm(t.definition[l]));
      });
      if (t.abbreviation) f.syn.push(norm(t.abbreviation));
      return { id: t.id, i: i, cat: t.category, catOrder: cats[t.category], term: t.term, f: f };
    });
    return { data: data, entries: entries, byId: entries.reduce(function (m, e) { m[e.id] = e; return m; }, {}) };
  }

  // a word starts at the beginning, after a space, or after the Arabic
  // article (ال، وال، بال، كال، فال) at the beginning of a word
  function startsWord(hay, at) {
    if (at === 0 || hay[at - 1] === ' ') return true;
    var before = hay.slice(Math.max(0, at - 3), at);
    var art = /(?:^|\s)(?:[وبكف]?ال)$/;
    return art.test(hay.slice(0, at).slice(-4)) || art.test(before);
  }

  // best score of one form against a list of normalised strings
  function fieldScore(list, form, exact, prefix, word, inner, han) {
    var best = 0;
    for (var k = 0; k < list.length; k++) {
      var h = list[k];
      if (!h) continue;
      if (h === form) return exact;
      var at = h.indexOf(form);
      if (at < 0) continue;
      var s = at === 0 ? prefix : startsWord(h, at) ? (h.lastIndexOf(' ', at) < 0 ? prefix : word) : han ? word : inner;
      if (s > best) best = s;
    }
    return best;
  }

  function scoreEntry(e, toks) {
    var total = 0;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i], best = 0;
      for (var j = 0; j < t.forms.length; j++) {
        var form = t.forms[j];
        var s = Math.max(
          fieldScore(e.f.term, form, 100, 80, 65, 45, t.han),
          fieldScore(e.f.syn, form, 90, 55, 45, 30, t.han),
          // definitions: whole words only for Latin and Arabic, so that "bar"
          // does not match inside "barrier"; any substring for Chinese
          (t.han ? form.length >= 2 : form.length >= 3) ? fieldScore(e.f.def, form, 20, 18, 15, t.han ? 12 : 0, t.han) : 0);
        if (s > best) best = s;
      }
      if (!best) return 0;          // every word must match
      total += best;
    }
    // the whole query as a phrase: a full term or synonym, or the start of one
    if (toks.length > 1) {
      var phrase = toks.map(function (t) { return t.word; }).join(' ');
      if (e.f.term.indexOf(phrase) >= 0 || e.f.syn.indexOf(phrase) >= 0) total += 100;
      else if (e.f.term.some(function (h) { return h.indexOf(phrase) === 0; })) total += 40;
    }
    return total;
  }

  /* search(index, query, { category, lang }) ->
       { results: [{ id, score }], counts: { categoryId: n }, total, query } */
  function search(index, query, opts) {
    opts = opts || {};
    var lang = LANGS.indexOf(opts.lang) >= 0 ? opts.lang : 'en';
    var toks = tokens(query);
    var hits = [];
    index.entries.forEach(function (e) {
      var s = toks.length ? scoreEntry(e, toks) : 1;
      if (s > 0) hits.push({ e: e, score: s });
    });
    var counts = {};
    hits.forEach(function (h) { counts[h.e.cat] = (counts[h.e.cat] || 0) + 1; });
    var total = hits.length;
    if (opts.category) hits = hits.filter(function (h) { return h.e.cat === opts.category; });
    var coll = typeof Intl !== 'undefined' && Intl.Collator ? new Intl.Collator(lang === 'zh' ? 'zh-Hans-u-co-pinyin' : lang) : null;
    hits.sort(function (a, b) {
      if (toks.length && b.score !== a.score) return b.score - a.score;
      if (!toks.length && a.e.catOrder !== b.e.catOrder) return a.e.catOrder - b.e.catOrder;
      var x = a.e.term[lang], y = b.e.term[lang];
      return coll ? coll.compare(x, y) : (x < y ? -1 : x > y ? 1 : 0);
    });
    return { results: hits.map(function (h) { return { id: h.e.id, score: h.score }; }), counts: counts, total: total, query: toks.map(function (t) { return t.word; }) };
  }

  /* Ranges [start, end) in the ORIGINAL text that match the query words. */
  function highlightRanges(text, query) {
    var toks = tokens(query);
    if (!toks.length || !text) return [];
    var nm = normMap(text), h = nm.text, ranges = [];
    toks.forEach(function (t) {
      t.forms.forEach(function (form) {
        var at = h.indexOf(form);
        while (at >= 0) {
          var a = nm.map[at], b = nm.map[at + form.length - 1];
          var end = b + 1;
          if (end < text.length && /[\uDC00-\uDFFF]/.test(text[end])) end++;
          ranges.push([a, end]);
          at = h.indexOf(form, at + form.length);
        }
      });
    });
    ranges.sort(function (x, y) { return x[0] - y[0] || y[1] - x[1]; });
    var out = [];
    ranges.forEach(function (r) {
      var last = out[out.length - 1];
      // join matches that touch or are separated only by spaces
      if (last && (r[0] <= last[1] || /^\s+$/.test(text.slice(last[1], r[0])))) last[1] = Math.max(last[1], r[1]);
      else out.push([r[0], r[1]]);
    });
    return out;
  }

  /* Text placed on the clipboard. */
  function copyText(t, which) {
    if (which === 'all') return 'EN: ' + t.term.en + '\nAR: ' + t.term.ar + '\nZH: ' + t.term.zh;
    return t.term[which];
  }

  /* ---- validation ------------------------------------------------------------ */
  var ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  function isStr(v) { return typeof v === 'string' && v.trim() !== '' && v === v.trim(); }
  function isObj(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }

  /* validate(data) -> { errors: [string], warnings: [string] }
     errors fail the build; warnings list shared synonyms that are allowed
     only because data.sharedSynonyms records that they were reviewed. */
  function validate(data) {
    var errors = [], warnings = [];
    var err = function (m) { errors.push(m); };
    if (!isObj(data)) return { errors: ['data is not an object'], warnings: [] };
    if (!Array.isArray(data.categories) || !data.categories.length) err('categories must be a non-empty array');
    if (!Array.isArray(data.terms) || !data.terms.length) err('terms must be a non-empty array');
    if (errors.length) return { errors: errors, warnings: warnings };

    var catIds = {};
    data.categories.forEach(function (c, i) {
      var w = 'category ' + i;
      if (!isObj(c) || !isStr(c.id) || !ID_RE.test(c.id)) return err(w + ': invalid id');
      if (catIds[c.id]) err(w + ': duplicate category id ' + c.id);
      catIds[c.id] = true;
      if (!isObj(c.name)) return err(c.id + ': name missing');
      LANGS.forEach(function (l) { if (!isStr(c.name[l])) err(c.id + ': name.' + l + ' missing'); });
    });

    var ids = {};
    data.terms.forEach(function (t, i) {
      var w = 'term ' + i + (t && t.id ? ' (' + t.id + ')' : '');
      if (!isObj(t)) return err(w + ': not an object');
      if (!isStr(t.id) || !ID_RE.test(t.id)) err(w + ': id must be lower-case words joined by hyphens');
      else if (ids[t.id]) err(w + ': duplicate id');
      ids[t.id] = true;
      if (!catIds[t.category]) err(w + ': unknown category "' + t.category + '"');
      ['term', 'definition'].forEach(function (k) {
        if (!isObj(t[k])) return err(w + ': ' + k + ' missing');
        LANGS.forEach(function (l) { if (!isStr(t[k][l])) err(w + ': ' + k + '.' + l + ' missing or not a trimmed string'); });
      });
      if (!isObj(t.synonyms)) err(w + ': synonyms must be an object with en, ar and zh arrays');
      else LANGS.forEach(function (l) {
        var s = t.synonyms[l];
        if (!Array.isArray(s)) return err(w + ': synonyms.' + l + ' must be an array');
        var seen = {};
        s.forEach(function (x, j) {
          if (!isStr(x)) return err(w + ': synonyms.' + l + '[' + j + '] is empty or not a string');
          var n = norm(x);
          if (seen[n]) err(w + ': synonym "' + x + '" repeated');
          seen[n] = true;
          if (t.term && n === norm(t.term[l])) err(w + ': synonym "' + x + '" repeats the term itself');
        });
      });
      if (!Array.isArray(t.related)) err(w + ': related must be an array');
      if (t.abbreviation !== undefined && !isStr(t.abbreviation)) err(w + ': abbreviation must be a non-empty string');
      ['example', 'notes'].forEach(function (k) {
        if (t[k] === undefined) return;
        if (!isObj(t[k])) return err(w + ': ' + k + ' must be an object');
        LANGS.forEach(function (l) { if (!isStr(t[k][l])) err(w + ': ' + k + '.' + l + ' missing'); });
      });
      if (t.review !== undefined) {
        if (!Array.isArray(t.review) || !t.review.length) err(w + ': review must be a non-empty array of languages');
        else t.review.forEach(function (l) { if (LANGS.indexOf(l) < 0) err(w + ': review language "' + l + '" unknown'); });
      }
      var known = { id: 1, category: 1, term: 1, definition: 1, synonyms: 1, related: 1, abbreviation: 1, example: 1, notes: 1, review: 1 };
      Object.keys(t).forEach(function (k) { if (!known[k]) err(w + ': unknown field "' + k + '"'); });
    });

    // related references
    data.terms.forEach(function (t) {
      if (!Array.isArray(t.related)) return;
      var seen = {};
      t.related.forEach(function (r) {
        if (!ids[r]) err(t.id + ': related term "' + r + '" does not exist');
        if (r === t.id) err(t.id + ': related to itself');
        if (seen[r]) err(t.id + ': related term "' + r + '" listed twice');
        seen[r] = true;
      });
    });

    // duplicates: the same term in the same language is one record, not two;
    // a term may not be another entry's synonym (the search would be
    // ambiguous); a synonym shared by two entries must be listed in
    // data.sharedSynonyms after review.
    var shared = {};
    (data.sharedSynonyms || []).forEach(function (s) { shared[s.lang + '|' + norm(s.text)] = s; });
    var usedShared = {};
    LANGS.forEach(function (l) {
      var termOwner = {}, synOwners = {};
      data.terms.forEach(function (t) {
        if (!t.term || !isStr(t.term[l])) return;
        var n = norm(t.term[l]);
        if (termOwner[n]) err('duplicate ' + l + ' term "' + t.term[l] + '": ' + termOwner[n] + ' and ' + t.id);
        else termOwner[n] = t.id;
      });
      data.terms.forEach(function (t) {
        var list = t.synonyms && t.synonyms[l];
        if (!Array.isArray(list)) return;          // reported above
        list.forEach(function (s) {
          if (!isStr(s)) return;
          var n = norm(s);
          if (termOwner[n] && termOwner[n] !== t.id) err(t.id + ': ' + l + ' synonym "' + s + '" is the term of ' + termOwner[n]);
          (synOwners[n] = synOwners[n] || []).push(t.id);
        });
      });
      Object.keys(synOwners).forEach(function (n) {
        var owners = synOwners[n].filter(function (v, i, a) { return a.indexOf(v) === i; });
        if (owners.length < 2) return;
        var key = l + '|' + n;
        if (shared[key]) { usedShared[key] = true; warnings.push(l + ' synonym "' + n + '" shared by ' + owners.join(', ') + ' (reviewed: ' + shared[key].reason + ')'); }
        else err(l + ' synonym "' + n + '" is shared by ' + owners.join(', ') + ': make it specific, or record it in sharedSynonyms after review');
      });
    });
    Object.keys(shared).forEach(function (k) { if (!usedShared[k]) err('sharedSynonyms entry "' + k + '" is not shared by any terms'); });
    return { errors: errors, warnings: warnings };
  }

  return { LANGS: LANGS, norm: norm, normMap: normMap, tokens: tokens, buildIndex: buildIndex, search: search,
           highlightRanges: highlightRanges, copyText: copyText, validate: validate };
}));
