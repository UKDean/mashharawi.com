#!/usr/bin/env python3
"""Give every Chinese page the same header menu.

The Chinese pages were written at different times and each carried its own
menu: some had 13 links, some 5, and the tool pages did not link to each
other. This script rewrites the menu links of every page under zh/ to one
list, keeps each page's own language links (English / العربية) untouched,
and marks the current section with aria-current="page".

Usage:
  python3 scripts/zh_nav.py          rewrite the pages
  python3 scripts/zh_nav.py --check  exit 1 if any page differs
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# (href, label). Tool and help pages are reached through 工具 and 帮助.
ITEMS = [
    ('/zh/rebar/', '钢筋供应'),
    ('/zh/rebar-cutting-bending/', '切割与弯曲'),
    ('/zh/rebar-weight-table/', '重量表'),
    ('/zh/rebar-quotation-guide/', '询价指南'),
    ('/zh/tools/', '工具'),
    ('/zh/help/', '帮助'),
]

# Pages whose menu entry is 工具 rather than their own link.
TOOL_PAGES = (
    '/zh/tools/',
    '/zh/rebar-cutting-optimizer/',
    '/zh/bbs-analyzer/',
    '/zh/steel-weight-verification/',
)

NAV_RE = re.compile(r'(<nav class="c-header__nav"[^>]*>\n)(.*?)(\n\s*</nav>)', re.S)


def current_href(url):
    if url.startswith('/zh/help/'):
        return '/zh/help/'
    if url.startswith(TOOL_PAGES):
        return '/zh/tools/'
    for href, _ in ITEMS:
        if url == href:
            return href
    return None


def build(url, body):
    lines = body.split('\n')
    indent = re.match(r'\s*', lines[0]).group(0) if lines else '    '
    lang = [l for l in lines if 'c-header__lang' in l]
    if len(lang) != 2:
        raise SystemExit(f'{url}: expected 2 language links, found {len(lang)}')
    cur = current_href(url)
    out = []
    for href, label in ITEMS:
        attr = ' aria-current="page"' if href == cur else ''
        out.append(f'{indent}<a href="{href}"{attr}>{label}</a>')
    return '\n'.join(out + lang)


def pages():
    for p in sorted((ROOT / 'zh').rglob('index.html')):
        url = '/' + str(p.parent.relative_to(ROOT)).replace('\\', '/') + '/'
        yield p, url


def main():
    check = '--check' in sys.argv
    changed = []
    for p, url in pages():
        html = p.read_text(encoding='utf-8')
        m = NAV_RE.search(html)
        if not m:
            raise SystemExit(f'{url}: no header menu found')
        new = html[:m.start(2)] + build(url, m.group(2)) + html[m.end(2):]
        if new != html:
            changed.append(url)
            if not check:
                p.write_text(new, encoding='utf-8')
    if check:
        if changed:
            print('Chinese menu differs on:', *changed, sep='\n  ')
            sys.exit(1)
        print('Chinese menu is the same on every page')
    else:
        print(f'Updated {len(changed)} page(s)')


if __name__ == '__main__':
    main()
