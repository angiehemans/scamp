# The canvas/preview parity harness

`test/e2e/parity/` renders the same page two ways and compares the
geometry of every element. It exists because canvas/preview divergence
kept being found by users rather than by us.

## How it works

Each fixture carries three things: the `tsx` and `css` a page would have
on disk, and the same markup written out as plain `html`.

- **Canvas side** — the TSX/CSS are pre-seeded into the test project, the
  app opens, and every `[data-scamp-id]` is measured.
- **Browser side** — the HTML is rendered against the identical CSS in
  Chromium, and every `[class]` is measured.

Both are measured relative to the page root and normalised out of the
canvas zoom, then compared field by field (x, y, w, h) with a 1px
tolerance.

## Two deliberate choices

**The oracle imports nothing from `src/`.** The browser side is
hand-written HTML wrapped in a document by the harness. An oracle that
shares code with the thing it checks can agree with it while both are
wrong — using the HTML exporter here would have meant an exporter bug
could hide a canvas bug. A consistency test asserts the `tsx` and `html`
of each fixture name the same elements, so they can't drift apart.

**The document includes the project's `theme.css`.** `app/layout.tsx`
imports it before the page's own module, and it carries the universal
`box-sizing: border-box` reset and the block-margin reset (whose comment
reads "keep canvas and preview in sync"). Leaving it out made the first
run report three divergences that were entirely artefacts of the missing
reset — padding off by exactly `2 × padding`, and `<p>` off by exactly
the browser's default margin.

That near-miss is the reason to state the rule: **the browser side must
be set up the way the real preview is**, or the harness invents bugs.

## Known gaps

A fixture with `knownGap` is asserted to FAIL, via `test.fail()`. The
suite stays green while the divergence is recorded, and the moment
someone fixes it the test flips to failing and has to be updated. Three
are recorded today:

| Fixture | Gap |
|---|---|
| `pseudo-element-before-content` | `customSelectorBlocks` are never applied to the canvas DOM, so `::before` / `::after` and any hand-written selector are invisible there |
| `flex-row-stretch-with-sized-sibling` | Scamp's model defaults `alignItems` to `flex-start`; CSS defaults it to `stretch`. The generator omits the declaration at the default, so the browser stretches and the canvas doesn't |
| `grid-two-columns` | The canvas grid branch reads `columnGap`/`rowGap` but never `el.gap`, so a grid using the `gap` shorthand has no gap on the canvas |

## What it does not catch

Geometry only. Paint-level properties — colour, gradients, shadows,
filters, blend modes — produce identical boxes and are invisible to this
harness. The gradient bug that prompted
[canvas-gradient-backgrounds.md](canvas-gradient-backgrounds.md) would
have passed. Pixel diffing is the answer there, and is deliberately left
to a later phase; geometry is where the divergences have actually been
and is far less brittle.

## Adding a fixture

Every parity bug that gets fixed should leave a fixture behind. Write the
`tsx`, the matching `html`, and the `css`; if the canvas doesn't match
yet, add `knownGap` describing why rather than deleting the fixture.

see docs/plans/canvas-preview-parity-plan.md
