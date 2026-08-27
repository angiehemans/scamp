# Export

Scamp exports in two different ways, for two different jobs:

- **Image export** — the current page or a selected element as a
  **PNG** or **SVG**. Lives in the Export section at the bottom of the
  WYSIWYG panel.
- **[HTML export](#export-as-html)** — the whole project as a folder of
  plain HTML and CSS files you can open in a browser or upload to any
  static host. Lives in the **Export HTML** button in the project
  header.

The rest of this page covers image export first, then HTML export.

## Triggering an Export

The Export section appears in the right-side properties panel when an
element is selected. Its scope is implicit:

- **No selection** → exports the whole page (the canvas frame).
- **One element selected** → exports just that element and its
  descendants.
- **Two or more elements selected** → controls disabled with an
  inline note. Select a single element to enable.

Right-clicking an element on the canvas also offers an "Export…" menu
item that scrolls the section into view.

## Section Controls

- **Format** dropdown — PNG or SVG.
- **Scale** segmented control (PNG only) — 1× / 2× / 3×. Multiplies
  the captured pixel resolution. Default is 2× (Retina-ready).
- **Size** read-out — live width × height of the export target.
- **Export** button — kicks off a native save dialog. The label
  reflects the scope: "Export rect_a1b2" or "Export page".

## What's Captured

Editor chrome — selection outlines, resize handles, drop indicators,
the canvas interaction layer — is **filtered out** of every capture.
Only the design content is written to the file. The capture happens
at the design's intrinsic size regardless of the user's current zoom
level (zooming doesn't affect output dimensions).

## Format Notes

### PNG

- Always raster output. Resolution depends on the **Scale** control.
- Transparent backgrounds are preserved — an element without a
  background color produces a transparent PNG.

### SVG

- Resolution-independent.
- Some complex CSS effects (filters, certain blend modes,
  `backdrop-filter`) may not be fully captured — the underlying
  `html-to-image` library has known limits there. PNG is more
  faithful for visual-effect-heavy designs.

## File Naming

The save dialog opens with a suggested filename based on the scope:

- Page export → `<page-name>.png` / `.svg`
- Element export → `<element-class>.png` / `.svg` (e.g.
  `hero-card_a1b2.png`)

The default save folder is the project folder. You can rename and
relocate inside the dialog.

## What's Not Yet Supported

- **PDF export** was scoped out for the v1 — only PNG and SVG ship
  today. PDF may return in a later release.
- **Multi-element export** — only one element at a time.
- **Animated states** — captures the element's current paint frame
  only. Hover styles and mid-animation frames are not reproduced.

---

# Export as HTML

**Export HTML** in the project header writes your whole project — every
page — as a folder of ordinary `.html` and `.css` files. No build step,
no framework, no `node_modules`. Double-click `index.html` to view it,
or drop the folder onto any static host.

## Doing it

1. Click **Export HTML** in the project header, next to Preview.
2. Choose where you want it — Documents, your Desktop, anywhere.
3. Scamp creates a new folder there named after your project and puts
   the site inside it, then opens it.

You're picking a *location*, not a destination folder. Choosing
`Documents` for a project called `my-site` gives you
`Documents/my-site/`. Nothing already in `Documents` is touched.

The button tells you where things stand:

| It says | Meaning |
|---|---|
| **Export HTML** | Ready. |
| **Exporting…** (spinning) | Writing files. |
| **Exported 12 files, 3 images** (green) | Done. Clears after a moment. |
| **Export failed** (red) | Something stopped it — hover for the reason. |

Hovering the green confirmation tells you the full path, which is worth
checking the first time since Scamp picks the folder name.

Exporting the same project to the same place again reuses its folder and
overwrites the previous export. If that name is taken by something Scamp
didn't write, it uses `my-site-2` instead rather than overwriting your
files — it will never write over a folder that isn't its own.

On some Linux desktops the folder won't pop open by itself. The green
confirmation on the button is the reliable signal that it worked.

## What you get

```
index.html        index.css      ← your home page
about/
  index.html      index.css      ← every other page
theme.css                        ← your design tokens
assets/                          ← your images
.scamp-export                    ← marks this folder as a Scamp export
```

Each page keeps its route as a folder, so `about/index.html` is served
at `/about` on a real host — the same address it had in Preview. Links
between your pages are rewritten to match and work both on a host and
straight off your disk.

## How it relates to your design

The export is meant to look identical to the canvas.

- **Components are flattened.** Each instance becomes ordinary HTML in
  place, with its own copy of the component's styles. Two instances of
  one component stay independent, so any per-instance sizing or text
  you set is preserved exactly.
- **Your CSS comes through as written** — including breakpoints,
  hover/focus states, transitions and animations. They're all CSS, so
  they keep working.
- **Images are copied** into `assets/` and referenced relatively.
- **`theme.css` is copied as-is**, so every token still resolves.

## Things to know

- **It's a snapshot, not a live link.** Changing your design doesn't
  update a folder you exported earlier — export again.
- **The export is static.** Scamp pages don't use JavaScript, so
  nothing is lost, but the files can't do anything interactive beyond
  what CSS provides.
- **Web fonts loaded by URL still need the network.** If your
  `theme.css` imports fonts from Google Fonts or Adobe, the exported
  pages fetch them the same way, so they won't render correctly fully
  offline.
- **It exports what's saved.** Scamp saves as you work, so this is
  almost always what you're looking at — but if the save indicator is
  still spinning, let it finish first.
