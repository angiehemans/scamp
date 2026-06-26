# SVG recolouring (fill / stroke from the panel)

How the SvgSection's Fill / Stroke / Stroke-width controls recolour an
inline `<svg>` element's shapes.

## Constraints that shaped this

`svgSource` is emitted **verbatim into JSX** (the page TSX) and also
injected into the **canvas DOM** via `dangerouslySetInnerHTML`. So it must
be valid in both:

- JSX forbids string `style="…"` (it wants `style={{…}}`) — an inline
  style on a shape crashes the Next.js page.
- Canvas HTML forbids `style={{…}}`.
- `var()` in an SVG **presentation attribute** (`fill="var(--x)"`) does
  **not** resolve in the browser.

So shapes must carry only **plain presentation attributes**
(`fill="#f00"`, `fill="none"`), and recolouring has to come from outside
`svgSource`.

## The mechanism

Recolour via the **wrapper's `fill` / `stroke` property** — set on the
`<svg>` element (inline style on the canvas, a class rule in the export).
A `fill`/`stroke` property inherits to descendants and, in the cascade,
**beats a descendant's presentation attribute** — which is exactly how
`svg { fill: … }` recolours an icon whose paths hardcode their own fill.
So setting the element's `fill` recolours every shape inside.

The one hazard: that inheritance would also paint a shape's `fill="none"`
solid — and icon sets (Lucide/Tabler) ship a transparent
`<path d="M0 0h24v24H0z" fill="none" stroke="none"/>` bounding box, which
would become a solid square covering the artwork. So on import
(`prepareSvgForInsert` in `src/renderer/src/lib/svg.ts`):

1. **Hoist root paint.** The root `<svg>`'s `fill` / `stroke` /
   `stroke-width` (outline icons put paint there; Scamp regenerates the
   wrapper so it'd otherwise be lost) become the element's typed
   `fill` / `stroke` / `strokeWidth` — the SvgSection's starting values.
2. **Drop fully-invisible shapes** — leaf shapes whose effective fill AND
   stroke are both `none` (the transparent bounding box). They paint
   nothing, so removing them is lossless and means the wrapper colour has
   nothing transparent to fill.

Everything else in `svgSource` is left untouched (valid JSX, byte-close to
the original).

## Emission

- `generateCode` (`declarations.ts`) emits `fill` / `stroke` /
  `stroke-width` on the element's class when set; the override emitter
  mirrors it for per-breakpoint / per-state paint.
- `elementToStyle` applies the same properties so the canvas matches.
- `cssPropertyMap` maps `fill` / `stroke` / `stroke-width` back to the
  typed fields (it also still maps the legacy `--svg-fill` / `--svg-stroke`
  custom properties to them, so any file exported by an earlier build
  migrates instead of dumping into `customProperties`).

## How to recolour, by icon type

- **Filled icons** → set **Fill** (the wrapper fill overrides the shapes).
- **Outline icons** (Lucide/Tabler — visible paths are *stroked*) → set
  **Stroke**. The hoisted starting values make this clear in the panel.

## Known limitations

- Element-level paint is one fill + one stroke, so a multi-colour icon
  collapses to a single colour when recoloured (per-shape editing is a
  non-goal).
- A non-bounding-box shape that's deliberately `fill="none"` but stroked
  (e.g. an outline circle) will be filled if you set **Fill** — that's the
  inherent meaning of an element-level fill. Use **Stroke** for outlines.

## Tests

`test/svg.test.ts` (drop-invisible, keep-visible, hoist) and
`test/e2e/canvas/svg-paste.spec.ts` (real engine: filled icon recolours
via Fill, outline icon recolours via Stroke with its transparent box
dropped, source stays valid JSX).
