# SVG recolouring (fill / stroke from the panel)

How the SvgSection's Fill / Stroke / Stroke-width controls reliably
recolour an inline `<svg>` element's shapes — including shapes that
hardcode their own `fill`/`stroke` (even `fill="none"`).

## The cascade problem

Setting `fill` on the wrapper `<svg>` (or its class) only reaches shapes
that *don't* declare their own paint: a shape's own `fill="#000"`
presentation attribute beats an inherited value, so element-level CSS
can't override it. `fill="none"` is the worst case — it stays invisible
no matter what you set.

## The mechanism

On import (`prepareSvgForInsert` in `src/renderer/src/lib/svg.ts`):

1. **Hoist root paint.** The original root `<svg>`'s `fill` / `stroke` /
   `stroke-width` (outline icon sets like Lucide put paint there) are
   read into the element's typed `fill` / `stroke` / `strokeWidth` fields.
   Scamp regenerates the `<svg>` wrapper, so without this they'd be lost.
2. **Var-ify shape paint.** Every shape's own `fill`/`stroke` presentation
   attribute is rewritten into an inline style referencing a CSS variable
   with the original as the fallback:
   `fill="#f00"` → `style="fill: var(--svg-fill, #f00)"`.

Then the element-level paint (`elementDeclarationLines`, `elementToStyle`)
emits **both** the property and the custom property:

```
.icon { fill: <c>; --svg-fill: <c>; stroke: <c2>; --svg-stroke: <c2>; stroke-width: <w>px }
```

- `fill`/`stroke` reach shapes that **inherit** (no own paint).
- `--svg-fill`/`--svg-stroke` drive shapes whose paint was **var-ified**.

When no colour is set, neither is emitted: inheriting shapes use their
default, var-ified shapes fall back to their original. So unset = original
look; set = everything recolours.

## Round-trip

`cssPropertyMap` maps `fill`, `stroke`, `stroke-width` **and** the
`--svg-fill` / `--svg-stroke` custom properties back to the same typed
fields, so the double emission collapses to one `fill` value on parse and
doesn't leak into `customProperties`. The override emitter
(`breakpointOverrideLines`) mirrors the double emission for per-breakpoint
/ per-state paint.

## Safety

The var style survives the render-side sanitizer (`sanitizeSvgInner` →
DOMPurify, svg profile) and resolves in Chromium — covered by
`test/svg.test.ts` (jsdom) and `test/e2e/canvas/svg-paste.spec.ts` (real
engine: `var(--svg-fill, #ff0000)` computes to red).

## Known limitation

Element-level paint is a single fill + single stroke, so an icon with
several distinct hardcoded colours collapses to one colour when recoloured
(per-shape editing is a non-goal). A rare edge case: an icon whose root
carries paint *and* whose shapes carry a *different* explicit paint — the
hoisted root value sets `--svg-fill`, overriding those shapes' fallbacks.
