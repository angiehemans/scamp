# Canvas cross-axis stretch: keep `width: 100%` in column parents

`elementToStyle` (`src/renderer/lib/elementToStyle.ts`) translates a
stretch-width/height flex child into the inline styles the canvas DOM
gets. For a flex item that fills its parent's **cross axis** the two
axes are not symmetric, and treating them the same caused a
canvas-vs-preview divergence.

## The bug

A flex-column root with `align-items: center`, containing a child with
`width: 100%; max-width: 620px`, centres that child in a browser and in
Scamp's preview (the inline width is definite — `620px` — and
`align-items: center` positions it).

The canvas used to substitute `align-self: stretch` for *any* cross-axis
stretch and drop the explicit size. `align-self: stretch` overrides the
parent's `align-items`, so the clamped item pinned to the start edge and
rendered **left-aligned** on the canvas while the preview stayed centred —
violating the "canvas mirrors the browser" rule.

## The fix

Only fall back to `align-self: stretch` when the cross axis is the
**block** axis:

- **Row parent** → cross axis is height (block). `height: 100%` collapses
  against an indefinite container height, so `align-self: stretch` is the
  correct fill. Kept.
- **Column parent** → cross axis is width (inline). `width: 100%` resolves
  against the container's definite inline size, so keep it verbatim. This
  preserves the parent's `align-items` and matches the browser/preview.

The main-axis routing was later found to have the same class of bug —
`flex: 1` is basis 0, not `width: 100%` — and now keeps the generated
`100%` too. See [canvas-flex-main-axis-stretch.md](canvas-flex-main-axis-stretch.md).

## Update: the generator now agrees (2026-08-28)

The canvas-side substitution above became insufficient the moment the
parity peel started injecting the generated stylesheet into the canvas:
`elementToStyle` dropped its inline height, so the FILE's `height: 100%`
applied instead, and the element collapsed on the canvas exactly as it
always had in a real browser. A full-height sidebar in a flex-row shell
(`width: 287px; height: 100%`) was invisible everywhere — the canvas had
merely stopped hiding that the generated CSS never worked.

`sizeDeclarationLines` now emits `align-self: stretch` (and no height)
for heightMode `stretch` when the parent is a flex row, and `parseCode`
maps `align-self: stretch` + no height on a flex-row child back to
heightMode `stretch`, so the round trip stays closed and the Size panel
reads "Fill" rather than "Auto". Existing files carrying the broken
`height: 100%` parse as stretch already, so they self-heal to
`align-self: stretch` on their next save.

The column asymmetry above is unchanged, and for the same reason it
always held: `width: 100%` resolves against a definite inline size, and
align-self there would override the parent's `align-items`.

Related: leaving fixed mode on the flex MAIN axis now also drops the
draw-time `flex-shrink: 0` (`releaseDrawnSize` in `@lib/flexChild`) —
`width: 100%` with shrink 0 is basis-100% that cannot shrink, so a
"fill width" panel next to a fixed sidebar overflowed the container by
exactly the sidebar's width. see docs/notes/draw-into-flex-parent.md
