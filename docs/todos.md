# Scamp — Known issues and follow-ups

Small, specific things that are understood but not fixed. Each entry says
what is wrong, why it was left, and what a fix has to deal with — so
picking one up does not mean rediscovering it.

Roughly ordered by how much they cost per day of ignoring them.

---

## 1. The duplicate-declaration indicator misses duplicates that change nothing

**Status:** confirmed, not fixed. Two attempts failed. Found 2026-08-28.

### What is wrong

The properties panel shows a dot on a section when the parser saw the
same CSS property declared twice in an element's class block. It does not
appear when the duplicate leaves the winning value unchanged.

Reproduce by appending to an element's block a declaration it already has,
with the same value the block already ends on. The file genuinely has two
`height` declarations. No dot appears.

That is the case where the warning is most useful: a duplicate that
changes nothing is pure dead weight, and the user has no other signal it
is there. A duplicate that DOES change the outcome at least shows up as a
different rendering.

### Why it happens

`src/renderer/src/syncBridge/externalEdit.ts` skips the reload when the
parsed tree regenerates to the same code it already has:

```ts
if (currentCode.tsx === nextCode.tsx && currentCode.css === nextCode.css) {
  return;
}
```

Right for the element tree — nothing to reload. But `cssDuplicates` is
not part of the tree. It describes the file's raw text, and a duplicate
whose winner is unchanged regenerates identically, so the bail throws the
new duplicate information away.

### What a fix has to deal with

Two attempts failed the same day, both in the sync bridge:

1. **A plain `setCssDuplicates` store action.** The subscription in
   `storeSubscription.ts` treats any un-flagged store write as a genuine
   canvas edit — `markUnsaved()` plus a scheduled write. The save status
   ended at `reloaded-from-disk`.
2. **The same action flagged as a load** (`isLoading: true`,
   `lastLoadKind: 'external'`, mirroring `reloadElements`). That fixed the
   first problem and then swallowed the user's *next* edit, so a size
   change never reached disk.

The work is in the load-flag lifecycle, not in duplicate tracking —
`findDuplicateDeclProps` already reports this correctly; the information
is computed and then discarded. **This wants its own session**: it is the
most delicate code in the app and two rushed attempts both broke saving.

A fix should also add the case to
`test/e2e/properties-panel/duplicate-indicator.spec.ts`, which currently
injects its duplicates at the END of the block so they win, deliberately
sidestepping the bug (noted in the spec).

---

## 2. The overflow indicator is root-level only

**Status:** deliberately deferred — this is a feature, not a bug fix.

`CanvasBoundaryOverlay` flags content spilling past the **page root**.
Nothing flags an over-full nested container — a flex row whose children
no longer fit renders its overflow visibly (correct, and deliberate: we
do not auto-clip), but with no affordance saying so.

More visible now that drawing no longer clamps to the parent, so an
oversized box in a fixed-size container is a normal thing to produce.

### Why it was not done with the rest

It is the only remaining item that adds new canvas chrome, and it needs
per-container measurement in exactly the subsystem that produced this
session's worst bug (an animated element's bounding box driving the
artboard extent, flipping the zoom on every edit). Two specific hazards:

- **Detection cannot use `scrollWidth`.** A container with
  `overflow: visible` reports `scrollWidth === clientWidth`, so spilling
  children are invisible to it — the same trap `measureFrame` documents.
  It needs the rect-based walk, per container.
- **Cost.** That walk currently runs once for the root. Running it for
  every container on every element change is a different performance
  proposition on a page with hundreds of elements.

Any overlay must also carry `data-canvas-chrome="true"` or it will bake
into PNG exports and thumbnails.

Worth its own small plan rather than a slot at the end of a batch.

---

## 3. `preserveDrawnSize` is inconsistent, by decision deferred

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

## 4. One e2e flakes under parallel load

`test/e2e/canvas/draw-into-flex.spec.ts` → "a box drawn hard against the
right edge is not collapsed to 20px" failed once when run in a batch
alongside `parity.spec.ts` (which launches its own chromium), and passed
three times in isolation immediately after.

Not a port collision — Playwright runs `workers: 1` here. Most likely a
timing assumption that does not hold when the machine is loaded. Left
recorded rather than chased, since the evidence is a single occurrence.

---

## 5. Diagnostics left in place

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
