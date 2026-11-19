#!/usr/bin/env python3
"""Rebuild the generated parts of the Construction Dictionary pages from
assets/construction-dictionary/terms.json.

Usage:  python3 scripts/build_dictionary.py           (rewrite the pages)
        python3 scripts/build_dictionary.py --check   (exit 1 if out of date)

Only the regions between the <!--cd:NAME--> ... <!--/cd:NAME--> markers are
rewritten in tools/, ar/tools/ and zh/tools/construction-dictionary/: the
term cards, the category buttons, the term count, and the DefinedTermSet
structured data. Everything else in the pages is left as it is.
Standard library only."""
import html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(ROOT, 'assets', 'construction-dictionary', 'terms.json')
SITE = 'https://mashharawi.com'
PATHS = {'en': '/tools/construction-dictionary/', 'ar': '/ar/tools/construction-dictionary/', 'zh': '/zh/tools/construction-dictionary/'}
HLANG = {'en': 'en', 'ar': 'ar', 'zh': 'zh-Hans'}
DIR = {'en': 'ltr', 'ar': 'rtl', 'zh': 'ltr'}
LANGS = ('en', 'ar', 'zh')
E = lambda s: html.escape(str(s), quote=True)

LABELS = {
    'en': dict(all='All', copy='Copy', copyAll='Copy all three', copyAria='Copy the {lang} term: {t}', copyAllAria='Copy the term in all three languages: {t}',
               more='Definitions, synonyms and notes', defsH='Definition in other languages', synH='Synonyms and other names', exH='Example', notesH='Notes',
               rel='Related:', review='To be reviewed', reviewTitle='This translation is not yet confirmed. Check it against the project documents.',
               langNames={'en': 'English', 'ar': 'Arabic', 'zh': 'Chinese'}, count='{n} terms',
               ldName='Construction Dictionary (English, Arabic, Chinese)'),
    'ar': dict(all='الكل', copy='نسخ', copyAll='نسخ اللغات الثلاث', copyAria='نسخ المصطلح باللغة {lang}: {t}', copyAllAria='نسخ المصطلح باللغات الثلاث: {t}',
               more='التعريفات والمرادفات والملاحظات', defsH='التعريف باللغات الأخرى', synH='المرادفات والأسماء الأخرى', exH='مثال', notesH='ملاحظات',
               rel='ذو صلة:', review='قيد المراجعة', reviewTitle='هذه الترجمة غير مؤكدة بعد. راجعها مع مستندات المشروع.',
               langNames={'en': 'الإنجليزية', 'ar': 'العربية', 'zh': 'الصينية'}, count='{n} مصطلحاً',
               ldName='قاموس مصطلحات البناء (الإنجليزية، العربية، الصينية)'),
    'zh': dict(all='全部', copy='复制', copyAll='复制三种语言', copyAria='复制{lang}术语：{t}', copyAllAria='复制三种语言的术语：{t}',
               more='定义、同义词和说明', defsH='其他语言的定义', synH='同义词和其他名称', exH='示例', notesH='说明',
               rel='相关：', review='待审核', reviewTitle='此译法尚未确认，请对照项目文件核实。',
               langNames={'en': '英文', 'ar': '阿拉伯文', 'zh': '中文'}, count='共 {n} 个术语',
               ldName='建筑工程术语词典（英文、阿拉伯文、中文）'),
}
SHORT = {'en': 'EN', 'ar': 'AR', 'zh': 'ZH'}


def load():
    with open(DATA_FILE, encoding='utf-8') as f:
        return json.load(f)


def card(t, k, data):
    p = LABELS[k]
    cats = {c['id']: c for c in data['categories']}
    terms = {x['id']: x for x in data['terms']}
    abbr = f'<span class="cd-abbr" lang="en" dir="ltr">{E(t["abbreviation"])}</span>' if t.get('abbreviation') else ''
    rows = []
    for l in LANGS:
        rv = f'<span class="cd-review" title="{E(p["reviewTitle"])}">{p["review"]}</span>' if l in t.get('review', []) else ''
        rows.append(f'<li><span class="cd-lang" title="{E(p["langNames"][l])}">{SHORT[l]}</span>'
                    f'<span><span class="cd-term" lang="{HLANG[l]}" dir="{DIR[l]}" data-f="term" data-l="{l}">{E(t["term"][l])}</span>{rv}</span>'
                    f'<button type="button" class="cd-copy cd-js" data-copy="{l}" aria-label="{E(p["copyAria"].format(lang=p["langNames"][l], t=t["term"][l]))}">{p["copy"]}</button></li>')
    extra = f'<dt>{p["defsH"]}</dt>' + ''.join(
        f'<dd lang="{HLANG[l]}" dir="{DIR[l]}"><b>{SHORT[l]}</b><span data-f="def" data-l="{l}">{E(t["definition"][l])}</span></dd>' for l in LANGS if l != k)
    syn = ''.join(f'<dd lang="{HLANG[l]}" dir="{DIR[l]}"><b>{SHORT[l]}</b><span data-f="syn" data-l="{l}">{E(" · ".join(t["synonyms"][l]))}</span></dd>'
                  for l in LANGS if t['synonyms'][l])
    if syn:
        extra += f'<dt>{p["synH"]}</dt>{syn}'
    if t.get('example'):
        extra += f'<dt>{p["exH"]}</dt><dd>{E(t["example"][k])}</dd>'
    if t.get('notes'):
        extra += f'<dt>{p["notesH"]}</dt><dd>{E(t["notes"][k])}</dd>'
    rel = ''
    if t['related']:
        rel = f'<p class="cd-rel"><span>{p["rel"]}</span> ' + ' '.join(
            f'<a href="#t-{r}" data-rel="{r}">{E(terms[r]["term"][k])}</a>' for r in t['related']) + '</p>'
    return (f'<article class="cd-card" id="t-{t["id"]}" data-id="{t["id"]}" data-cat="{t["category"]}" tabindex="-1" aria-labelledby="h-{t["id"]}">\n'
            f'<div class="cd-top"><span class="cd-chip">{E(cats[t["category"]]["name"][k])}</span>{abbr}</div>\n'
            f'<h3 class="cd-title" id="h-{t["id"]}">{E(t["term"][k])}</h3>\n'
            f'<ul class="cd-tr">{"".join(rows)}</ul>\n'
            f'<p class="cd-def" data-f="def" data-l="{k}">{E(t["definition"][k])}</p>\n'
            f'<details class="cd-more"><summary>{p["more"]}</summary><dl>{extra}</dl></details>\n'
            f'{rel}\n'
            f'<div class="cd-actions cd-js"><button type="button" class="cd-copy" data-copy="all" aria-label="{E(p["copyAllAria"].format(t=t["term"][k]))}">{p["copyAll"]}</button></div>\n'
            f'</article>')


def regions(k, data):
    """The generated HTML for each marked region of the page in language k."""
    p = LABELS[k]
    terms = data['terms']
    n = len(terms)
    url = SITE + PATHS[k]
    cats = f'<button type="button" class="calc-chip" data-cat="" aria-pressed="true">{p["all"]} <span class="cd-n">{n}</span></button>' + ''.join(
        f'<button type="button" class="calc-chip" data-cat="{c["id"]}" aria-pressed="false">{E(c["name"][k])} <span class="cd-n">{sum(1 for t in terms if t["category"] == c["id"])}</span></button>'
        for c in data['categories'])
    ld = {"@context": "https://schema.org", "@type": "DefinedTermSet", "@id": url + '#set', "name": p['ldName'], "url": url, "inLanguage": HLANG[k],
          "hasDefinedTerm": [{"@type": "DefinedTerm", "@id": url + '#t-' + t['id'], "name": t['term'][k], "description": t['definition'][k],
                              "termCode": t['id'], "inDefinedTermSet": url + '#set'} for t in terms]}
    return {
        'list': '\n' + '\n'.join(card(t, k, data) for t in terms) + '\n',
        'cats': cats,
        'count': p['count'].format(n=n),
        'ld': '<script type="application/ld+json">\n' + json.dumps(ld, ensure_ascii=False, separators=(',', ':')) + '\n</script>',
    }


def mark(name, body):
    return f'<!--cd:{name}-->{body}<!--/cd:{name}-->'


def apply(page_html, k, data):
    out = page_html
    for name, body in regions(k, data).items():
        pat = re.compile(r'<!--cd:' + name + r'-->.*?<!--/cd:' + name + r'-->', re.S)
        if len(pat.findall(out)) != 1:
            raise SystemExit(f'{PATHS[k]}: marker cd:{name} missing or repeated')
        out = pat.sub(lambda _m: mark(name, body), out)
    return out


def main():
    data = load()
    check = '--check' in sys.argv
    stale = []
    for k in LANGS:
        path = os.path.join(ROOT, PATHS[k].strip('/'), 'index.html')
        with open(path, encoding='utf-8') as f:
            old = f.read()
        new = apply(old, k, data)
        if new != old:
            stale.append(PATHS[k])
            if not check:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new)
    if check:
        if stale:
            print('Out of date: ' + ', '.join(stale) + '. Run python3 scripts/build_dictionary.py')
            sys.exit(1)
        print('Pages match terms.json')
    else:
        print(('Updated: ' + ', '.join(stale)) if stale else 'Pages already match terms.json')


if __name__ == '__main__':
    main()
