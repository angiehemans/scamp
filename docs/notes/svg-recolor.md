# SVG recolouring (fill / stroke from the panel)

How the SvgSection's Fill / Stroke / Stroke-width controls recolour an
inline `<svg>` element's shapes — including shapes that hardcode their own
paint — without filling shapes that are deliberately `none`.

## The cascade traps

1. A `fill`/`stroke` **property** on an ancestor *does* override a
   descendant's `fill`/`stroke` **presentation attribute** (this is how
   `svg { fill: … }` recolours icons). Convenient — but it also overrides
   `fill="none"`, so an element-level fill paints transparent bounding
   boxes solid, covering the artwork.
2. So we can't just set `fill` on the wrapper. Instead we drive shapes
   through a **CSS custom property** that only affects shapes which opt in
   by referencing it.

## The mechanism

On import (`prepareSvgForInsert` in `src/renderer/src/lib/svg.ts`):

1. **Hoist root paint.** The original root `<svg>`'s `fill` / `stroke` /
   `stroke-width` (outline icon sets like Lucide put paint there) become
   the element's typed `fill` / `stroke` / `strokeWidth` — Scamp
   regenerates the wrapper, so otherwise they'd be lost. They're the
   SvgSection's starting values.
2. **Var-ify shape paint.** Each shape's paint becomes a CSS variable with
   the original as fallback:
   - explicit colour → `style="fill: var(--svg-fill, <orig>)"`,
   - **`none` is left as a plain attribute** (deliberately unpainted —
     transparent boxes, the fill side of outline icons),
   - a shape with *no* paint, which would inherit the root's, gets the var
     with the hoisted root value as fallback (so it keeps its look and
     stays recolourable).

The element-level paint then emits **only** the custom properties (plus
`stroke-width`, which is safe to inherit):

```
.icon { --svg-fill: <c>; --svg-stroke: <c2>; stroke-width: <w>px }
```

- Shapes referencing `var(--svg-fill, …)` recolour.
- `fill="none"` shapes are untouched (the custom property does nothing to
  a shape that doesn't reference it) — no coloured squares.

When no colour is set, no custom property is emitted: every shape falls
back to its original.

## Round-trip

`cssPropertyMap` maps `fill`, `stroke`, `stroke-width` **and** the
`--svg-fill` / `--svg-stroke` custom properties back to the same typed
fields, so the emitted custom properties round-trip into `fill`/`stroke`
rather than leaking into `customProperties`. `elementToStyle` applies the
same `--svg-*` custom properties (not the `fill`/`stroke` property) so the
canvas matches. The override emitter mirrors this for per-breakpoint /
per-state paint.

## Safety

The var style survives the render-side sanitizer (`sanitizeSvgInner` →
DOMPurify, svg profile) and resolves in Chromium — covered by
`test/svg.test.ts` (jsdom) and `test/e2e/canvas/svg-paste.spec.ts` (real
engine: setting Stroke recolours an outline icon while its `fill="none"`
box stays unpainted).

## Known limitations

- Element-level paint is a single fill + single stroke, so an icon built
  from several distinct hardcoded colours collapses to one when recoloured
  (per-shape editing is a non-goal).
- Outline icons recolour via **Stroke**, not Fill (their visible paths are
  stroked, not filled) — the hoisted starting values make this clear in
  the panel.
- Edge case: an icon whose root carries paint *and* whose shapes carry a
  *different* explicit colour — the hoisted root value sets `--svg-fill`,
  overriding those shapes' fallbacks.
