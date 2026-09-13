# motion

Remotion compositions that render an animated LinkedIn post in the same visual
language as the site.

This folder is **not** part of the website. GitHub Pages ignores it. It builds
video files, which you upload to LinkedIn yourself. Nothing here runs in a
browser visiting mashharawi.com.

## Why Remotion is here and not in the site

Remotion renders video with React. It cannot power the animated band in the
hero, because that band is interactive: it reacts to the cursor and to scroll,
and a video cannot. The band on the site is `assets/mill.js`, about 6 KB of
plain JavaScript with no build step.

What Remotion is good at is the thing the site cannot do: producing an actual
MP4 file that LinkedIn will autoplay in the feed. That is what this folder is
for. The two share the same geometry, so a post and the site look like the
same object.

## Compositions

| id | size | length | what it is |
|---|---|---|---|
| `NotePost` | 1080 x 1080 | 10 s | A note turned into a square post: kicker, headline, up to three figures, footer. |
| `MillBand` | 1600 x 420 | 6 s | The band on its own, sweeping out and back so it loops without a cut. |

## Running it

Needs Node 18 or newer. First time in this folder:

```
npm install
```

That downloads a headless Chrome the first time it renders, so the first run
is slow and needs a connection.

Preview and edit interactively, which is the fastest way to work:

```
npm run studio
```

Studio opens in a browser. The `NotePost` props (kicker, headline, figures,
footer) are editable in the right-hand panel because they are declared with a
schema, so you can rewrite a post and watch it without touching code.

Render:

```
npm run post     # out/post.mp4
npm run band     # out/band.mp4
npm run still    # out/post.png, the first frame, for a static post
```

To render a specific note without opening Studio, pass the props:

```
npx remotion render NotePost out/post.mp4 --props='{
  "kicker": "Reinforcing steel",
  "headline": "Grade 80 is decided at design, not at supply.",
  "figures": [
    {"value":"420","unit":"N/mm²","label":"Grade 60 yield, minimum"},
    {"value":"550","unit":"N/mm²","label":"Grade 80 yield, minimum"},
    {"value":"31","unit":"%","label":"Increase"}
  ],
  "footnote": "Omar Mashharawi  /  mashharawi.com"
}'
```

## Editing

- `src/theme.ts` holds the colours. They are copied from `assets/site.css`.
  If a colour changes on the site, change it here too.
- `src/MillBand.tsx` is the particle field. Every position is a pure function
  of the frame number, with no clock and no unseeded randomness, which is what
  lets Remotion render frames in parallel and still produce identical output.
- `src/NotePost.tsx` is the post layout.
- `src/Root.tsx` registers the compositions and sets their size and length.

## Not yet verified

The compositions typecheck and bundle cleanly, but no frame has been rendered
yet: the environment they were written in could not download headless Chrome.
The first `npm run still` on your machine is the real test. If something looks
wrong in that first PNG, it will be a layout value in `NotePost.tsx`, not a
structural problem.
