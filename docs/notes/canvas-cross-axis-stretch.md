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

The main-axis routing (`flex: 1` for the growing axis) is unchanged.
