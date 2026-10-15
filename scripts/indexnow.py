"""Tell IndexNow search engines (Bing, Yandex, Seznam, Naver) about the site's pages.

Bing's index feeds ChatGPT search and Copilot, so a page announced here can
show up in AI answers within days instead of waiting for a crawl.

Run after a deploy has gone live:
    python3 scripts/indexnow.py            # every URL in sitemap.xml
    python3 scripts/indexnow.py URL [URL]  # only these
The key file at the site root (<key>.txt) proves the site owns the key.
"""
import glob, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = "mashharawi.com"

keys = [os.path.basename(p)[:-4] for p in glob.glob(os.path.join(ROOT, "*.txt"))
        if re.fullmatch(r"[0-9a-f]{32}\.txt", os.path.basename(p))]
if len(keys) != 1:
    raise SystemExit("expected exactly one <32 hex>.txt key file at the site root")
key = keys[0]

urls = sys.argv[1:] or re.findall(r"<loc>([^<]+)</loc>", open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read())
body = json.dumps({"host": HOST, "key": key, "keyLocation": f"https://{HOST}/{key}.txt", "urlList": urls}).encode()
req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body,
                             headers={"Content-Type": "application/json; charset=utf-8"})
with urllib.request.urlopen(req, timeout=30) as r:
    print(r.status, f"{len(urls)} URL(s) submitted")
