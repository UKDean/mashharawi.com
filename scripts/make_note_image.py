#!/usr/bin/env python3
"""Draw an article infographic from a small JSON spec, in Arabic, English or Chinese.

Usage: python3 scripts/make_note_image.py spec.json assets/img/notes/<slug>

Writes <slug>.webp (1400x1400, shown inside the article) and <slug>.jpg
(1200x630, the share image for LinkedIn, WhatsApp and X).

Spec keys: lang ("ar"|"en"|"zh"), title, subtitle, and any of
  "table": {"head": [...], "rows": [[...], ...]}   up to 12 rows
  "points": ["...", ...]                            up to 6
  "note": "one line under the content"
Only facts and numbers that are in the article. No logos, no photos of people.
Fonts are the Linux VM's (DejaVu for Arabic shaping via raqm, Noto CJK for Chinese).
"""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont

FONTS = {
    "ar": ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    "en": ("/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"),
    "zh": ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"),
}
BG, INK, NAVY, BAND, CARD, LINE, HOT, MUTED = "#EEF1F5", "#141B2B", "#1A2747", "#253F7E", "#F7F8FA", "#D5DBE4", "#D8600F", "#4A5568"


class Canvas:
    def __init__(self, w, h, lang):
        self.im = Image.new("RGB", (w, h), BG)
        self.d = ImageDraw.Draw(self.im)
        self.w, self.h, self.lang = w, h, lang
        self.rtl = lang == "ar"
        self.reg, self.bold = FONTS[lang]

    def font(self, size, bold=False):
        return ImageFont.truetype(self.bold if bold else self.reg, size)

    def kw(self):
        return {"direction": "rtl", "language": "ar"} if self.rtl else ({"language": "zh-Hans"} if self.lang == "zh" else {})

    def width(self, text, f):
        return self.d.textlength(text, font=f, **self.kw())

    def wrap(self, text, f, maxw):
        if self.lang == "zh":
            units, join = list(text), ""
        else:
            units, join = text.split(), " "
        lines, cur = [], ""
        for u in units:
            t = (cur + join + u) if cur else u
            if self.width(t, f) <= maxw:
                cur = t
            else:
                if cur:
                    lines.append(cur)
                cur = u
        if cur:
            lines.append(cur)
        return lines

    def text(self, x0, x1, y, text, f, fill=INK, align="start"):
        """Draw one line between x0 and x1; start = right edge in Arabic."""
        tw = self.width(text, f)
        if align == "center":
            x = x0 + (x1 - x0 - tw) / 2
        elif (align == "start") != self.rtl:
            x = x0
        else:
            x = x1 - tw
        self.d.text((x, y), text, font=f, fill=fill, **self.kw())

    def para(self, x0, x1, y, text, f, fill=INK, gap=1.35, max_lines=3, align="start"):
        for line in self.wrap(text, f, x1 - x0)[:max_lines]:
            self.text(x0, x1, y, line, f, fill, align)
            y += int(f.size * gap)
        return y


def render(spec, w, h, compact):
    c = Canvas(w, h, spec.get("lang", "en"))
    pad = int(w * 0.045)
    x0, x1 = pad, w - pad
    s = w / 1400
    y = int(pad * 1.1)
    title_f = c.font(int((60 if compact else 78) * s * (1.0 if not compact else 1.35)), True)
    y = c.para(x0, x1, y, spec["title"], title_f, NAVY, 1.18, 2)
    if spec.get("subtitle"):
        y += int(8 * s)
        y = c.para(x0, x1, y, spec["subtitle"], c.font(int((34 if not compact else 40) * s), False), MUTED, 1.3, 2)
    y += int(26 * s)
    foot_h = int(92 * s if not compact else 110 * s)
    bottom = h - foot_h - int(24 * s)

    tbl = spec.get("table")
    if tbl and not compact:
        head, rows = tbl["head"], tbl["rows"][:12]
        n = len(head)
        row_h = min(int(64 * s), int((bottom - y - 80 * s) / (len(rows) + 1)))
        fsz = int(min(30 * s, row_h * 0.48))
        f, fb = c.font(fsz), c.font(fsz, True)
        cols = list(range(n))
        if c.rtl:
            cols = cols[::-1]
        cw = (x1 - x0) / n
        c.d.rounded_rectangle([x0, y, x1, y + row_h], radius=int(12 * s), fill=NAVY)
        for slot, i in enumerate(cols):
            cx0 = x0 + slot * cw
            c.text(cx0 + 6, cx0 + cw - 6, y + (row_h - fsz) / 2 - 4, str(head[i]), fb, "#FFFFFF", "center")
        y += row_h
        for r, row in enumerate(rows):
            c.d.rectangle([x0, y, x1, y + row_h], fill=CARD if r % 2 == 0 else "#E6EAF0")
            for slot, i in enumerate(cols):
                cx0 = x0 + slot * cw
                c.text(cx0 + 6, cx0 + cw - 6, y + (row_h - fsz) / 2 - 4, str(row[i]), fb if i == 0 else f, INK, "center")
            y += row_h
        y += int(24 * s)

    if tbl and compact:
        # Share image: up to 4 key-number cards from the table's first rows.
        head, rows = tbl["head"], [r for r in tbl["rows"] if len(r) > 1][:4]
        if rows:
            n, gap = len(rows), int(20 * s)
            cw = ((x1 - x0) - gap * (n - 1)) / n
            ch = min(int(250 * s), bottom - y)
            order = list(range(n))[::-1] if c.rtl else list(range(n))
            for slot, i in enumerate(order):
                cx0 = x0 + slot * (cw + gap)
                c.d.rounded_rectangle([cx0, y, cx0 + cw, y + ch], radius=int(18 * s), fill=CARD)
                c.text(cx0, cx0 + cw, y + int(26 * s), f"{head[0]} {rows[i][0]}", c.font(int(30 * s)), MUTED, "center")
                c.text(cx0, cx0 + cw, y + int(78 * s), str(rows[i][1]), c.font(int(84 * s), True), NAVY, "center")
                c.text(cx0, cx0 + cw, y + int(190 * s), str(head[1]), c.font(int(26 * s)), MUTED, "center")
            y += ch + int(20 * s)
        spec = dict(spec, note=None)

    pts = spec.get("points") or []
    if pts and (not tbl or not compact):
        pts = pts[: (3 if compact else 6)]
        f = c.font(int((30 if not compact else 36) * s))
        box_top = y
        inner = []
        yy = y + int(22 * s)
        for p in pts:
            lines = c.wrap(p, f, (x1 - x0) - int(90 * s))[:2]
            inner.append((yy, lines))
            yy += int(len(lines) * f.size * 1.3 + 16 * s)
        if yy + int(10 * s) <= bottom:
            c.d.rounded_rectangle([x0, box_top, x1, yy + int(6 * s)], radius=int(16 * s), fill="#E3E8EF")
            for (ly, lines) in inner:
                r = int(14 * s)
                cx = (x1 - int(36 * s)) if c.rtl else (x0 + int(36 * s))
                cy = ly + f.size * 0.62
                c.d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=HOT)
                tx0, tx1 = (x0 + int(24 * s), x1 - int(70 * s)) if c.rtl else (x0 + int(70 * s), x1 - int(24 * s))
                for k, line in enumerate(lines):
                    c.text(tx0, tx1, ly + k * f.size * 1.3, line, f, INK)
            y = yy + int(24 * s)

    if spec.get("note") and y + 40 * s < bottom:
        c.para(x0, x1, y, spec["note"], c.font(int(24 * s)), MUTED, 1.3, 2)

    c.d.rectangle([0, h - foot_h, w, h], fill=BAND)
    c.text(0, w, h - foot_h + (foot_h - int(42 * s)) / 2 - 6, "mashharawi.com", ImageFont.truetype(FONTS["en"][1], int(42 * s)), "#FFFFFF", "center")
    return c.im


def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    out = sys.argv[2]
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    render(spec, 1400, 1400, False).save(out + ".webp", "WEBP", quality=88)
    render(spec, 1200, 630, True).save(out + ".jpg", "JPEG", quality=86, optimize=True)
    print("wrote", out + ".webp", out + ".jpg")


if __name__ == "__main__":
    main()
