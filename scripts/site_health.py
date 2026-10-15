"""Daily crawl check of the live site.

Crawls every URL in the live sitemap the way a search engine would and checks
that nothing stands between a crawler and a page:

  - every sitemap URL answers 200 with no redirect, and its canonical is itself
  - every hreflang alternate answers 200
  - the no-slash, http:// and www. forms reach the right page in one 301/308
  - robots.txt allows crawling and names the sitemap
  - search and AI crawlers (Googlebot, Bingbot, GPTBot, ClaudeBot, ...) get 200
  - llms.txt lists every published note; feed.xml items open
  - the IndexNow key file is live
  - every JSON-LD block on every page parses

It also checks the repo agrees with itself: every note in notes/ has a built
page and a sitemap entry.

Exit code 0 = healthy, 1 = problems (the report is printed either way and
written to health-report.md). Fixes are left to the workflow, which only
applies safe ones (rebuild notes, add missing llms.txt lines).

    python3 scripts/site_health.py
"""
import json, os, re, sys, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://mashharawi.com"
UA = "Mozilla/5.0 (compatible; mashharawi-health/1.0; +https://mashharawi.com/)"
CRAWLERS = ["Googlebot/2.1", "bingbot/2.0", "GPTBot/1.0", "OAI-SearchBot/1.0", "ChatGPT-User/1.0",
            "ClaudeBot/1.0", "Claude-User/1.0", "PerplexityBot/1.0", "Google-Extended", "CCBot/2.0"]

problems, warnings, notes = [], [], []


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def fetch(url, ua=UA, follow=True):
    """(status, final_url, body, location) without raising on HTTP errors."""
    bust = ("&" if "?" in url else "?") + "cb=health"
    opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(url + bust, headers={"User-Agent": ua})
    try:
        with opener.open(req, timeout=30) as r:
            return r.status, r.geturl().replace(bust, ""), r.read().decode("utf-8", "replace"), None
    except urllib.error.HTTPError as e:
        return e.code, url, "", e.headers.get("Location")
    except Exception as e:  # network, TLS, timeout
        return 0, url, str(e), None


def check_page(url):
    status, final, body, _ = fetch(url, follow=False)
    if status != 200:
        problems.append(f"{url} answers {status} (should be 200 with no redirect)")
        return
    canon = re.search(r'<link rel="canonical" href="([^"]+)"', body)
    if url.endswith((".xml", ".txt")):
        return
    if not canon:
        warnings.append(f"{url} has no canonical link")
    elif canon.group(1) != url:
        problems.append(f"{url} canonical points elsewhere: {canon.group(1)}")
    if re.search(r'<meta name="robots" content="[^"]*noindex', body):
        problems.append(f"{url} is marked noindex")
    for alt in re.findall(r'<link rel="alternate" hreflang="[^"]+" href="([^"]+)"', body):
        if alt != url:
            s, *_ = fetch(alt, follow=False)
            if s != 200:
                problems.append(f"{url} hreflang alternate {alt} answers {s}")
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', body, re.S):
        try:
            json.loads(block)
        except ValueError as e:
            problems.append(f"{url} has invalid JSON-LD: {e}")


def check_variant(variant, target):
    status, _, _, loc = fetch(variant, follow=False)
    if status not in (301, 308):
        problems.append(f"{variant} answers {status}, expected a 301/308 to {target}")
        return
    loc = urllib.parse.urljoin(variant, loc or "")
    if loc.split("?")[0] != target:
        s2, final, *_ = fetch(variant)
        if final.split("?")[0] != target or s2 != 200:
            problems.append(f"{variant} redirects to {loc}, not {target}")
        else:
            warnings.append(f"{variant} reaches {target} in more than one hop")


def main():
    status, _, sitemap, _ = fetch(SITE + "/sitemap.xml")
    if status != 200:
        problems.append(f"sitemap.xml answers {status}")
        sitemap = ""
    urls = re.findall(r"<loc>([^<]+)</loc>", sitemap)
    notes.append(f"{len(urls)} URLs in the live sitemap")

    with ThreadPoolExecutor(8) as ex:
        list(ex.map(check_page, urls))
        # trailing-slash, scheme and host variants
        pairs = [(u.rstrip("/"), u) for u in urls if u.endswith("/") and u != SITE + "/"]
        pairs += [("http://mashharawi.com/", SITE + "/"), ("https://www.mashharawi.com/", SITE + "/"),
                  ("http://www.mashharawi.com/", SITE + "/")]
        list(ex.map(lambda p: check_variant(*p), pairs))

    s, _, robots, _ = fetch(SITE + "/robots.txt")
    if s != 200:
        problems.append(f"robots.txt answers {s}")
    else:
        if re.search(r"^Disallow:\s*/\s*$", robots, re.M):
            problems.append("robots.txt disallows the whole site")
        if "Sitemap: https://mashharawi.com/sitemap.xml" not in robots:
            warnings.append("robots.txt does not name the sitemap")

    for ua in CRAWLERS:
        s, *_ = fetch(SITE + "/", ua=f"Mozilla/5.0 (compatible; {ua}; +https://example.com/bot)")
        if s != 200:
            # Cloudflare may refuse a bot name coming from a non-bot IP; the
            # real crawlers come from their own IPs, so this is a warning.
            warnings.append(f"{ua.split('/')[0]} gets {s} on the home page (from this runner's IP)")

    s, _, llms, _ = fetch(SITE + "/llms.txt")
    slugs = [m.group(1) for u in urls if (m := re.fullmatch(re.escape(SITE) + r"/writing/([a-z0-9-]+)/", u))]
    if s != 200:
        problems.append(f"llms.txt answers {s}")
    else:
        missing = [x for x in slugs if f"/writing/{x}/" not in llms]
        if missing:
            problems.append("llms.txt is missing notes: " + ", ".join(missing))

    s, _, feed, _ = fetch(SITE + "/feed.xml")
    if s != 200:
        problems.append(f"feed.xml answers {s}")
    else:
        for link in re.findall(r"<item>.*?<link>([^<]+)</link>", feed, re.S)[:10]:
            if link not in urls:
                problems.append(f"feed item {link} is not in the sitemap")

    keys = [f[:-4] for f in os.listdir(ROOT) if re.fullmatch(r"[0-9a-f]{32}\.txt", f)]
    for k in keys:
        s, _, body, _ = fetch(f"{SITE}/{k}.txt")
        if s != 200 or body.strip() != k:
            problems.append(f"IndexNow key file /{k}.txt is not served correctly ({s})")

    # the repo agrees with itself
    for f in sorted(os.listdir(os.path.join(ROOT, "notes"))):
        m = re.fullmatch(r"\d{4}-\d{2}-\d{2}-([a-z0-9-]+)\.md", f)
        if not m:
            continue
        slug = m.group(1)
        if not os.path.exists(os.path.join(ROOT, "writing", slug, "index.html")):
            problems.append(f"notes/{f} has no built page (writing/{slug}/)")
        if f"{SITE}/writing/{slug}/" not in urls:
            problems.append(f"notes/{f} is not in the live sitemap")

    report = ["# Site health", ""]
    report += [f"- {n}" for n in notes]
    report += ["", f"## Problems ({len(problems)})", ""] + ([f"- {p}" for p in sorted(problems)] or ["- none"])
    report += ["", f"## Warnings ({len(warnings)})", ""] + ([f"- {w}" for w in sorted(warnings)] or ["- none"])
    text = "\n".join(report) + "\n"
    print(text)
    open(os.path.join(ROOT, "health-report.md"), "w", encoding="utf-8").write(text)
    sys.exit(1 if problems else 0)


def fix_llms():
    """Add any published note missing from llms.txt under '## Writing'."""
    path = os.path.join(ROOT, "llms.txt")
    llms = open(path, encoding="utf-8").read()
    anchor = "## Writing\n\n"
    added = []
    for f in sorted(os.listdir(os.path.join(ROOT, "notes")), reverse=True):
        m = re.fullmatch(r"\d{4}-\d{2}-\d{2}-([a-z0-9-]+)\.md", f)
        if not m or f"{SITE}/writing/{m.group(1)}/" in llms or anchor not in llms:
            continue
        head = open(os.path.join(ROOT, "notes", f), encoding="utf-8").read().split("\n---", 1)[0]
        get = lambda k: (re.search(r"^" + k + r":\s*(.+)$", head, re.M) or [None, ""])[1].strip().strip("\"'")
        line = f"- [{get('title')}]({SITE}/writing/{m.group(1)}/): {get('summary')}" + (" (Arabic)" if get("lang") == "ar" else "")
        llms = llms.replace(anchor, anchor + line + "\n", 1)
        added.append(m.group(1))
    if added:
        open(path, "w", encoding="utf-8").write(llms)
    print("llms.txt: added " + (", ".join(added) if added else "nothing"))


if __name__ == "__main__":
    fix_llms() if "--fix-llms" in sys.argv else main()
