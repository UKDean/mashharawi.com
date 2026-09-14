#!/usr/bin/env python3
"""Build notes/*.md into writing/ pages, feed.xml and sitemap.xml.

Source of truth is notes/*.md. Everything in writing/, feed.xml and
sitemap.xml is generated: edit the Markdown, never the output.
Files starting with "_" are ignored. Run: python3 scripts/build_notes.py
"""
import os, re, html, datetime, email.utils, markdown

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE, AUTHOR = "https://mashharawi.com", "Omar Mashharawi"
NOTES, OUT = os.path.join(ROOT, "notes"), os.path.join(ROOT, "writing")
# Pages that are not built from notes/*.md. Each entry is an English page,
# its Arabic twin, and the priority of each. They are listed here because this
# script writes the whole sitemap: a page added by hand elsewhere and not added
# here disappears from the sitemap on the next notes build.
PAIRS = [
    ("/", "/ar/", "1.0", "0.9"),
    ("/tools/", "/ar/tools/", "0.9", "0.8"),
    ("/tools/rebar-weight/", "/ar/tools/rebar-weight/", "0.9", "0.8"),
    ("/tools/steel-sections/", "/ar/tools/steel-sections/", "0.9", "0.8"),
    ("/tools/openpdfkit/", "/ar/tools/openpdfkit/", "0.8", "0.7"),
]
# Pages with no English/Arabic twin (Arabic-only, or vice versa) — same
# "listed here or it vanishes from the sitemap" rule as PAIRS above.
SINGLES = [
    ("/contract-check/", "0.5"),
]
F_EN = ('<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..700'
        '&family=IBM+Plex+Mono:wght@400;500&family=Newsreader:opsz,wght@6..72,300..500&display=swap" rel="stylesheet">')
F_AR = ('<link href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@300;400;500;600;700'
        '&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">')


def parse(path):
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", open(path, encoding="utf-8").read(), re.S)
    if not m:
        raise SystemExit(os.path.basename(path) + ": missing front matter")
    meta, body = {}, m.group(2).strip()
    for line in m.group(1).splitlines():
        if line.strip() and ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip().lower()] = v.strip().strip('"').strip("'")
    for r in ("title", "date", "summary"):
        if not meta.get(r):
            raise SystemExit(os.path.basename(path) + ": '" + r + "' is required")
    if not body:
        raise SystemExit(os.path.basename(path) + ": empty body")
    try:
        meta["dt"] = datetime.date.fromisoformat(meta["date"])
    except ValueError:
        raise SystemExit(os.path.basename(path) + ": date must be YYYY-MM-DD")
    meta["lang"] = meta.get("lang", "en").lower()
    if meta["lang"] not in ("en", "ar"):
        raise SystemExit(os.path.basename(path) + ": lang must be en or ar")
    meta["dir"] = "rtl" if meta["lang"] == "ar" else "ltr"
    meta["slug"] = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", os.path.basename(path)[:-3])
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", meta["slug"]):
        raise SystemExit(os.path.basename(path) + ": name must be YYYY-MM-DD-lower-with-hyphens.md")
    meta["url"] = SITE + "/writing/" + meta["slug"] + "/"
    meta["body"] = markdown.markdown(body, extensions=["extra", "sane_lists", "smarty"])
    return meta


def shell(lang, d, title, desc, canon, body, head="", robots=None, fonts=None):
    e = html.escape
    f = fonts or (F_AR if lang == "ar" else F_EN)
    home = "/ar/" if lang == "ar" else "/"
    back = "العودة إلى الموقع" if lang == "ar" else "Back to the site"
    alln = "كل المقالات" if lang == "ar" else "All notes"
    skip = "تخطَّ إلى المحتوى" if lang == "ar" else "Skip to content"
    brand = "عمر المشهراوي" if lang == "ar" else "OMAR MASHHARAWI"
    site = "الموقع" if lang == "ar" else "Site"
    tools = "/ar/tools/" if lang == "ar" else "/tools/"
    toolsl = "الأدوات" if lang == "ar" else "Tools"
    rob = '<meta name="robots" content="' + robots + '">' if robots else ""
    return f"""<!DOCTYPE html>
<html lang="{lang}" dir="{d}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="author" content="{AUTHOR}">
{rob}
<link rel="canonical" href="{canon}">
<meta name="theme-color" content="#E4E6E3">
<meta property="og:type" content="article">
<meta property="og:url" content="{canon}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{SITE}/og-cover.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="alternate" type="application/rss+xml" title="{AUTHOR} notes" href="{SITE}/feed.xml">
<link rel="stylesheet" href="/assets/site.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
{f}
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
{head}</head>
<body>
<a class="skip" href="#main">{skip}</a>
<header>
  <div class="wrap bar">
    <a class="brand" href="{home}">{brand}<span>.</span></a>
    <nav aria-label="Primary"><ul>
      <li><a href="{home}">{site}</a></li>
      <li><a href="{tools}">{toolsl}</a></li>
      <li><a href="/writing/">{alln}</a></li>
      <li><a href="/feed.xml">RSS</a></li>
    </ul></nav>
  </div>
</header>
<main id="main">
{body}
</main>
<footer>
  <div class="wrap bar">
    <span>&copy; {datetime.date.today().year} {AUTHOR} &middot; mashharawi.com</span>
    <span><a class="lang" href="{home}">{back}</a></span>
  </div>
</footer>
</body>
</html>
"""


def jstr(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def note_page(n):
    e = html.escape
    label = "مقال" if n["lang"] == "ar" else "Note"
    alln = "كل المقالات" if n["lang"] == "ar" else "All notes"
    ld = ('<script type="application/ld+json">\n{\n'
          '  "@context": "https://schema.org",\n  "@type": "BlogPosting",\n'
          '  "headline": ' + jstr(n["title"]) + ',\n'
          '  "description": ' + jstr(n["summary"]) + ',\n'
          '  "datePublished": "' + n["date"] + '",\n'
          '  "dateModified": "' + n["date"] + '",\n'
          '  "inLanguage": "' + n["lang"] + '",\n'
          '  "mainEntityOfPage": "' + n["url"] + '",\n'
          '  "author": { "@type": "Person", "name": "' + AUTHOR + '", "url": "' + SITE + '/" },\n'
          '  "publisher": { "@type": "Person", "name": "' + AUTHOR + '", "url": "' + SITE + '/" }\n'
          '}\n</script>\n')
    body = f"""  <article class="sec note">
    <div class="wrap">
      <p class="eyebrow">{label} &middot; <time datetime="{n['date']}">{n['date']}</time></p>
      <h1>{e(n['title'])}</h1>
      <p class="lead">{e(n['summary'])}</p>
      <div class="prose">
{n['body']}
      </div>
      <p class="note-back"><a href="/writing/">&larr; {alln}</a></p>
    </div>
  </article>"""
    return shell(n["lang"], n["dir"], n["title"] + " — " + AUTHOR, n["summary"], n["url"], body, ld)


def index_page(notes):
    e = html.escape
    intro = ("Short pieces on the commercial side of steel, and on the software and "
             "automation that sit next to it.")
    if notes:
        intro += " Published here first, then shared on LinkedIn."
        rows = "\n".join(
            '        <li>\n'
            '          <a href="/writing/' + n["slug"] + '/" lang="' + n["lang"] + '" dir="' + n["dir"] + '">\n'
            '            <span class="note-date"><time datetime="' + n["date"] + '">' + n["date"] + '</time></span>\n'
            '            <span class="note-text"><b>' + e(n["title"]) + '</b><span>' + e(n["summary"]) + '</span></span>\n'
            '          </a>\n        </li>' for n in notes)
        listing = '      <ul class="note-list">\n' + rows + '\n      </ul>'
        robots = None
    else:
        listing = ('      <p class="muted">The first note has not been published yet. '
                   'Add a Markdown file under <code>notes/</code> and it appears here automatically.</p>')
        robots = "noindex, follow"
    body = f"""  <section class="sec">
    <div class="wrap">
      <div class="sec-head">
        <p class="eyebrow">Writing</p>
        <h1>Notes</h1>
        <p class="lead">{intro}</p>
      </div>
{listing}
      <p class="note-back"><a href="/feed.xml">RSS feed</a> &middot; <a href="https://www.linkedin.com/in/mashharawi" target="_blank" rel="noopener me">LinkedIn</a></p>
    </div>
  </section>"""
    fonts = F_EN + "\n" + F_AR if any(n["lang"] == "ar" for n in notes) else F_EN
    return shell("en", "ltr", "Notes — " + AUTHOR,
                 "Notes on commercial steel, software and automation by Omar Mashharawi.",
                 SITE + "/writing/", body, robots=robots, fonts=fonts)


def rss(notes):
    esc = lambda s: html.escape(s, quote=False)
    now = email.utils.format_datetime(datetime.datetime.now(datetime.timezone.utc))
    items = "\n".join(
        '    <item>\n      <title>' + esc(n["title"]) + '</title>\n'
        '      <link>' + n["url"] + '</link>\n'
        '      <guid isPermaLink="true">' + n["url"] + '</guid>\n'
        '      <pubDate>' + email.utils.format_datetime(datetime.datetime.combine(
            n["dt"], datetime.time(9, 0), datetime.timezone.utc)) + '</pubDate>\n'
        '      <description>' + esc(n["summary"]) + '</description>\n    </item>' for n in notes)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n'
            '    <title>' + AUTHOR + ' — Notes</title>\n'
            '    <link>' + SITE + '/writing/</link>\n'
            '    <atom:link href="' + SITE + '/feed.xml" rel="self" type="application/rss+xml"/>\n'
            '    <description>Notes on commercial steel, software and automation.</description>\n'
            '    <language>en</language>\n    <lastBuildDate>' + now + '</lastBuildDate>\n'
            + items + '\n  </channel>\n</rss>\n')


def sitemap(notes):
    rows = []
    for en_path, ar_path, en_pri, ar_pri in PAIRS:
        en, ar = SITE + en_path, SITE + ar_path
        alts = ('    <xhtml:link rel="alternate" hreflang="en" href="' + en + '"/>\n'
                '    <xhtml:link rel="alternate" hreflang="ar" href="' + ar + '"/>\n'
                '    <xhtml:link rel="alternate" hreflang="x-default" href="' + en + '"/>\n')
        for loc, pri in ((en, en_pri), (ar, ar_pri)):
            rows.append('  <url>\n    <loc>' + loc + '</loc>\n' + alts +
                        '    <changefreq>monthly</changefreq>\n    <priority>' + pri + '</priority>\n  </url>')
    for path, pri in SINGLES:
        rows.append('  <url>\n    <loc>' + SITE + path + '</loc>\n'
                    '    <changefreq>monthly</changefreq>\n    <priority>' + pri + '</priority>\n  </url>')
    if notes:
        rows.append('  <url>\n    <loc>' + SITE + '/writing/</loc>\n    <lastmod>'
                    + max(n["date"] for n in notes) + '</lastmod>\n'
                    '    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>')
        for n in notes:
            rows.append('  <url>\n    <loc>' + n["url"] + '</loc>\n    <lastmod>' + n["date"] + '</lastmod>\n'
                        '    <changefreq>yearly</changefreq>\n    <priority>0.7</priority>\n  </url>')
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
            '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + "\n".join(rows) + '\n</urlset>\n')


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
    if old != text:
        open(path, "w", encoding="utf-8").write(text)
        print("  wrote", os.path.relpath(path, ROOT))


def main():
    os.makedirs(NOTES, exist_ok=True)
    files = sorted(f for f in os.listdir(NOTES) if f.endswith(".md") and not f.startswith("_"))
    notes = sorted((parse(os.path.join(NOTES, f)) for f in files),
                   key=lambda n: (n["dt"], n["slug"]), reverse=True)
    print("building", len(notes), "note(s)")
    seen = set()
    for n in notes:
        if n["slug"] in seen:
            raise SystemExit("duplicate slug: " + n["slug"])
        seen.add(n["slug"])
        write(os.path.join(OUT, n["slug"], "index.html"), note_page(n))
    write(os.path.join(OUT, "index.html"), index_page(notes))
    write(os.path.join(ROOT, "feed.xml"), rss(notes))
    write(os.path.join(ROOT, "sitemap.xml"), sitemap(notes))
    print("done")


if __name__ == "__main__":
    main()
