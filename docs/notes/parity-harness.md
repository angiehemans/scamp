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
someone fixes it the test flips to failing and has to be updated.

**None are recorded today.** All three the harness found on its first run
are fixed: the `align-items` default
([note](align-items-default.md)), the grid `gap` shorthand
([note](grid-gap-shorthand.md)), and `::before` / custom selectors, which
closed when the canvas started loading the page's own stylesheet
([note](canvas-injected-stylesheet.md)).

## Fixtures must not depend on text metrics

The canvas runs in Electron's Chromium and the oracle in a standalone
Chromium build. They resolve `system-ui` slightly differently, so the
intrinsic width of a text run differs by a few pixels between them — a
fixture with `width: fit-content` on a `<p>` reported a 3.2px divergence
that was pure font resolution.

Give text elements an explicit size. Testing text metrics across two
browser instances isn't meaningful; testing the box they sit in is.

## Regenerate the shims before running it

**Regenerate the shims before running the harness.** `tsconfig.web.json`
includes `test/**`, so these specs get committed `.js` siblings like
everything else, and Playwright imports the `.js`. Editing a fixture
without `npx tsc --build tsconfig.web.json --force` runs the previous
version — which shows up as stale test titles and results that don't
match the source.

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
