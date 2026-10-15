"""Publish notes whose date has come.

A note waiting for its day lives in notes/scheduled/YYYY-MM-DD-slug.md. When
that date (Riyadh time) is today or past, this moves it to notes/, sets its
front-matter date to the publish date, and lists the moved files on stdout.
It also adds the note to llms.txt under the Writing section, so AI crawlers
find it the same day.

Runs from .github/workflows/publish-scheduled.yml every morning, so publishing
does not depend on anyone's computer being on.

    python3 scripts/publish_scheduled.py                # publish what is due
    python3 scripts/publish_scheduled.py --as-of 2026-10-19   # pretend it is that day
"""
import argparse, datetime, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUEUE = os.path.join(ROOT, "notes", "scheduled")
NOTES = os.path.join(ROOT, "notes")
LLMS = os.path.join(ROOT, "llms.txt")
RIYADH = datetime.timezone(datetime.timedelta(hours=3))


def front(text, key):
    m = re.search(r"^" + key + r":\s*(.+)$", text.split("\n---", 1)[0], re.M)
    return m.group(1).strip().strip('"').strip("'") if m else ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--as-of", help="YYYY-MM-DD; defaults to today in Riyadh")
    args = ap.parse_args()
    today = datetime.date.fromisoformat(args.as_of) if args.as_of else datetime.datetime.now(RIYADH).date()

    if not os.path.isdir(QUEUE):
        print("no queue", file=sys.stderr)
        return
    moved = []
    for name in sorted(os.listdir(QUEUE)):
        m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})-([a-z0-9][a-z0-9-]*)\.md", name)
        if not m:
            continue
        day, slug = datetime.date.fromisoformat(m.group(1)), m.group(2)
        print(f"queued: {name} ({'due' if day <= today else 'waits until ' + str(day)})", file=sys.stderr)
        if day > today:
            continue
        if any(re.fullmatch(r"\d{4}-\d{2}-\d{2}-" + re.escape(slug) + r"\.md", f) for f in os.listdir(NOTES)):
            raise SystemExit(f"{slug} is already published; remove {name} from the queue")
        text = open(os.path.join(QUEUE, name), encoding="utf-8").read()
        text = re.sub(r"^date:.*$", f"date: {day.isoformat()}", text, count=1, flags=re.M)
        dest = os.path.join(NOTES, name)
        open(dest, "w", encoding="utf-8").write(text)
        os.remove(os.path.join(QUEUE, name))
        moved.append((slug, front(text, "title"), front(text, "summary"), front(text, "lang") or "en"))
        print(f"notes/{name}")

    if moved and os.path.exists(LLMS):
        llms = open(LLMS, encoding="utf-8").read()
        anchor = "## Writing\n\n"
        for slug, title, summary, lang in moved:
            url = f"https://mashharawi.com/writing/{slug}/"
            if url in llms or anchor not in llms:
                continue
            line = f"- [{title}]({url}): {summary}" + (" (Arabic)" if lang == "ar" else "") + "\n"
            llms = llms.replace(anchor, anchor + line, 1)
        open(LLMS, "w", encoding="utf-8").write(llms)


if __name__ == "__main__":
    main()
