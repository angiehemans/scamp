# Scamp — Known issues and follow-ups

Small, specific things that are understood but not fixed. Each entry says
what is wrong, why it was left, and what a fix has to deal with — so
picking one up does not mean rediscovering it.

Roughly ordered by how much they cost per day of ignoring them.

---

## 1. `preserveDrawnSize` is inconsistent, by decision deferred

**Status:** parked by Angie on 2026-08-29 after the options were laid
out — "leave this as is for now, so far I love how it works".

The `flex-shrink: 0` guard is written when you **draw** a fixed box into
a flex parent, and not when you **type** a fixed size into the Size
panel. Nothing removes it when the axis later switches to Fill.

The three coherent resolutions:

- **`px` means don't-shrink** — apply the guard whenever the main axis
  becomes fixed through the UI, remove it when it becomes Fill/Hug/Auto.
  Matches Figma's Fixed/Fill/Hug vocabulary, no new UI. Recommended.
- **An explicit "don't shrink" control** in the Size section.
- **Strip-on-Fill only** — about ten lines, closes the collision, changes
  nothing else.

Whichever is chosen, the guard must be **stored in the file**, never
derived: a derived declaration is invisible to the browser and broke
`parity: nested-flex-with-gap-and-padding` (canvas 120.0 vs browser
103.7). see the "Rule 2 reversal" section of
`docs/plans/flex-sizing-contract-plan.md`.

---

## 2. One e2e flakes under parallel load

`test/e2e/canvas/draw-into-flex.spec.ts` → "a box drawn hard against the
right edge is not collapsed to 20px" failed once when run in a batch
alongside `parity.spec.ts` (which launches its own chromium), and passed
three times in isolation immediately after.

Not a port collision — Playwright runs `workers: 1` here. Most likely a
timing assumption that does not hold when the machine is loaded. Left
recorded rather than chased, since the evidence is a single occurrence.

---

## 3. Diagnostics left in place

Not bugs — decisions to revisit, listed so they are not discovered as
mysteries.

- **Zoom/extent tracing**, opt-in behind
  `localStorage.setItem('scamp.debugZoom', '1')` in `Viewport.tsx`. It
  found the animated-glow extent bug in one round after three wrong
  guesses; kept because the loop is only observable in a running canvas.
- **What broke the canvas after `f4fe569`** was never explained. Its
  fill-height half was measured inert on every page in `scamp-ui` (zero
  elements would migrate), and that half has since re-landed in
  `414088b` without a recurrence. The remaining suspect was
  `releaseDrawnSize`, which is not currently in the tree.

---

## Done

- **The duplicate-declaration indicator** now fires for duplicates that
  do not change the winning value. Third attempt, first with the cause
  understood: the update routes through `reloadElements` with a SHALLOW
  COPY of the elements — the same reference makes the store subscription
  bail before it clears `isLoading`, which silently swallows every later
  edit. `d2d6ece`
- **Nested-container overflow markers — built, then removed on
  evidence.** Shipped in `4d4123a`, reverted after one session against a
  real design: a 1px border on a nested element was enough to raise a
  warning, and that class of false positive recurs constantly in real
  CSS. Not worth the noise. The root-level `CanvasBoundaryOverlay`
  already covers the case that matters — content escaping the page —
  and that is the decision, not a deferral. If it is ever revisited, the
  problem to solve first is sub-pixel and border-width overflow, not
  detection; detection was never the hard part.
- **Port and timing flakes** (`authService`, `mcpServer` integration,
  `app-settings` e2e) — per-test ports and a missing poll. `1033248`
- **Component thumbnails mutating the live canvas** — switched to
  `captureIsolatedPng`; that path had no coverage at all, so it gained
  an e2e that decodes the PNG and counts pixels. `1033248`
- **`<button>` inside `<button>`** in the properties panel — the header
  is now an empty stretched button with its accessories as siblings, with
  a spec asserting zero nesting and zero React warnings. `1033248`
- **Fill-height in a flex column** — `flex: 1`, fixing `.body_a0b4` in
  scamp-ui's start page which was rendering 0 tall. `9e89c66`
