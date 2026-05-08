# Export

Scamp can export the current page or a selected element as a **PNG**
or **SVG** without leaving the app. The Export section sits at the
bottom of the WYSIWYG panel (Figma-style), so it's always reachable
when you have an element selected.

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
