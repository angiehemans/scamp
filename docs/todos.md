# Scamp — Known issues and follow-ups

Small, specific things that are understood but not fixed. Each entry says
what is wrong, why it was left, and what a fix has to deal with — so
picking one up does not mean rediscovering it.

Roughly ordered by how much they cost per day of ignoring them.

---

## 1. Three tests flake on ports and timing

**Status:** confirmed, recurring. Seen 2026-08-28.

### What is wrong

Three unrelated tests fail intermittently in full runs and pass in
isolation and on rerun:

| test | failure |
|---|---|
| `test/authService.test.ts` → "releases the port so a second attempt can run" and "survives a restart once persisted" | binds a fixed `TEST_PORT = 18990` |
| `test/integration/mcpServer.integration.test.ts` → "rejects a missing token" | binds a port |
| `test/e2e/settings/app-settings.spec.ts` → "the privacy toggle mints an install id" | reads settings before the write lands (`installId` null) |

### Why it matters more than it looks

This is the real cost: **a green run stopped being evidence.** Twice this
week a genuine failure had to be picked out from flakes by hand, and once
a run with four real failures was nearly reported as passing because the
exit code came from the wrong command in a shell pipeline. Flakes train
you to skim, which is exactly when a real regression walks through.

### What a fix looks like

The two port cases want the treatment `authLoopbackAndExchange.test.ts`
already uses: allocate from a per-test counter (`nextPort = 45300`)
rather than a module constant, so parallel vitest files cannot collide.
`authService.test.ts` needs its `loopbackPort` override threaded the same
way. The settings one is a missing await/poll, not a port.

---

## 2. The duplicate-declaration indicator misses duplicates that change nothing

**Status:** confirmed, not fixed. Found 2026-08-28.

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
is computed and then discarded.

A fix should also add the case to
`test/e2e/properties-panel/duplicate-indicator.spec.ts`, which currently
injects its duplicates at the END of the block so they win, deliberately
sidestepping the bug (noted in the spec).

---

## 3. Component thumbnails still mutate the live canvas

**Status:** known, one-line-ish fix available.

`src/renderer/src/lib/componentThumbnail.ts` still calls `capturePng`,
which blanks the canvas frame's `transform` and strips selection classes
for the duration of the shot. On every **component** save that produces
the same visible zoom jump and selection flicker that was fixed for
project thumbnails.

The fix already exists: `captureIsolatedPng` in the same module clones
the frame into an off-screen wrapper and touches nothing live. Switching
the component path over is mostly deletion. Note the two traps it was
built around — the offscreen placement must sit on a *wrapper* (a node
carrying `position: fixed; left: -100000px` renders itself out of the
capture and comes back blank), and identifying attributes must be
stripped from the clone.

see `docs/notes/project-thumbnails.md`

---

## 4. `<button>` nested inside `<button>` in the properties panel

**Status:** benign, real, unfixed.

React logs `validateDOMNesting(...): <button> cannot appear as a
descendant of <button>` — `PresetMenu` renders a button inside
`Section`'s header button (seen via `ShadowsSection`). Invalid HTML;
works today, but it is the kind of thing that breaks a keyboard or
screen-reader path without warning.

Fixing it means restructuring the section header so the disclosure
control and the preset menu are siblings rather than nested — small, but
it touches every section, so it wants its own pass.

---

## 5. The overflow indicator is root-level only

`CanvasBoundaryOverlay` flags content spilling past the **page root**.
Nothing flags an over-full nested container — a flex row whose children
no longer fit renders its overflow visibly (correct, and deliberate: we
do not auto-clip), but with no affordance saying so.

This became more visible once drawing stopped clamping to the parent, so
an oversized box in a fixed-size container is now a normal thing to
produce.

see `docs/plans/flex-sizing-contract-plan.md` rule 4

---

## 6. `preserveDrawnSize` is inconsistent, by design decision deferred

The `flex-shrink: 0` guard is written when you **draw** a fixed box into
a flex parent, and not when you **type** a fixed size into the Size
panel. Nothing removes it when the axis later switches to Fill, which is
the collision behind the sidebar bug.

Deliberately parked after the options were laid out (2026-08-29). The
three coherent resolutions:

- **`px` means don't-shrink** — apply the guard whenever the main axis
  becomes fixed through the UI, remove it when it becomes Fill/Hug/Auto.
  Matches Figma's Fixed/Fill/Hug vocabulary, no new UI. Recommended.
- **An explicit "don't shrink" control** in the Size section.
- **Strip-on-Fill only** — about ten lines, closes the collision, changes
  nothing else.

Whichever is chosen, the guard must be **stored in the file**, never
derived: a derived declaration is invisible to the browser and broke
`parity: nested-flex-with-gap-and-padding` (canvas 120.0 vs browser
103.7). see the "Rule 2 reversal" section of the plan.

---

## 7. Fill-height is fixed for flex ROWS only

`sizeDeclarationLines` emits `align-self: stretch` for cross-axis fill in
a flex row. A flex **column** child set to Fill height is on the *main*
axis and still emits `height: 100%`, which has the same
indefinite-container mushiness — it just was not the reported bug and was
left out of a core-function change rather than shipped unverified.

Worth a Phase-0-style measurement before touching: the column main-axis
case may want `flex: 1`, which Phase 0 showed is **not** a neutral
respelling on the row main axis (it re-laid-out the hero in
`canvas-flex-main-axis-stretch.md`, inner 857 → 460).

---

## 8. Diagnostics left in place

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
