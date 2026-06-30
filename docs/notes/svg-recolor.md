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

## Two bugs this had to get right (both subtle)

1. **Render a real `<svg>`.** The canvas must mount the element as an actual
   `<svg>` and inject the shapes into it. The legacy placeholder mapped
   `svg → div` (`canvasRenderTag`), so the shapes landed inside a `<div>`
   — HTML namespace, where `<rect>`/`<path>` **never paint and have zero
   layout size**. `getComputedStyle().fill` still reported a colour (the CSS
   cascade), which masked the bug for a long time. `ElementRenderer` now
   calls `createElement('svg', …)` for `tag === 'svg'`, not
   `canvasRenderTag(tag)`.
2. **A shape's own paint beats inherited paint.** In a real SVG cascade a
   descendant's own `fill="#f00"` presentation attribute **wins over** an
   inherited `fill` from the wrapper. (The earlier note claimed the
   opposite — that was the wrong assumption.) So a wrapper colour can only
   recolour a shape that has *no* own paint. Outline icons work for free
   (their stroked paths carry no paint and inherit), but any shape that
   hardcodes a colour won't budge until that paint is removed.

## The mechanism

Recolour via the **wrapper's `fill` / `stroke` property** — set on the
`<svg>` element (inline style on the canvas, a class rule in the export) —
which inheriting shapes pick up. To make *every* shape inheriting, on
import (`prepareSvgForInsert` in `src/renderer/src/lib/svg.ts`):

1. **Hoist root paint.** The root `<svg>`'s `fill` / `stroke` /
   `stroke-width` (outline icons put paint there; Scamp regenerates the
   wrapper so it'd otherwise be lost) become the element's typed
   `fill` / `stroke` / `strokeWidth` — the SvgSection's starting values and
   the icon's original look.
2. **Drop fully-invisible shapes** — leaf shapes whose effective fill AND
   stroke are both `none` (the transparent bounding box Lucide/Tabler ship
   as `<path d="M0 0h24v24H0z" fill="none" stroke="none"/>`). They paint
   nothing, so removing them is lossless and means the wrapper colour has
   nothing transparent to paint solid.
3. **Strip shapes' own `fill` / `stroke`** (anything except `none`). Without
   this a hardcoded colour beats the wrapper (bug #2) and the shape won't
   recolour. `none` is kept (deliberate "unpainted" intent). The original
   look survives via the hoisted root paint on the wrapper.

`svgSource` then carries only `none` (or no) paint — valid JSX, and every
visible shape inherits the element-level fill/stroke.

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
  non-goal). Stripping shape paint on import is what makes this uniform —
  the original per-shape colours aren't preserved (the hoisted root paint
  is), which is the right trade for icons but wrong for illustrations
  (those route to `<img>` above the inline size threshold).
- A non-bounding-box shape that's deliberately `fill="none"` but stroked
  (e.g. an outline circle) will be filled if you set **Fill** — that's the
  inherent meaning of an element-level fill. Use **Stroke** for outlines.

## Tests

`test/svg.test.ts` (drop-invisible, keep-visible, hoist) and
`test/e2e/canvas/svg-paste.spec.ts` (real engine: filled icon recolours
via Fill, outline icon recolours via Stroke with its transparent box
dropped, source stays valid JSX).
