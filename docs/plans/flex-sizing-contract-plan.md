# The flex sizing contract — Plan

Status: draft, awaiting answers to the open questions at the bottom.
Supersedes `draw-free-space-plan.md` (free-space-constrained drawing),
which is kept as a stub pointing here.

## Context

Drawing and sizing rectangles inside flex parents produced a chain of
bugs this week, each fix exposing the next:

1. Draw clamp shrank width to `parentW - x` → the 20px bug.
2. Clamp read model sizes that are meaningless for stretch parents → the
   100px bug.
3. A full flex line shrank the drawn box below its own CSS → fixed by
   auto-adding `flex-shrink: 0` at draw time (`preserveDrawnSize`).
4. That leftover guard broke Fill width (`width: 100%` that cannot
   shrink overflows by its sibling's width) → `releaseDrawnSize`,
   commit `f4fe569`, reverted in `7238e00`.

Before re-fixing, we compared how two shipping tools resolve the same
tension between "the box you drew is the box you get" and "flex layout
negotiates sizes":

**Figma** lets you draw any size into an auto-layout frame and grows
the frame to fit. That is not exotic — it is exactly what CSS does when
the parent is `fit-content`. It only *looks* magical because Figma
frames float on an infinite canvas.

**Paper** (HTML-canvas tool, closest analogue to Scamp) exports this
for a frame with three drawn children:

```jsx
<div style={{ display: 'flex', gap: 16, overflow: 'clip', padding: '16px', ... }}>
  <div style={{ flexShrink: '0', height: '423px',  width: '342px' }} />
  <div style={{ flexShrink: '0', height: '1526px', width: '464px' }} />
  <div style={{ flexShrink: '0', height: '593px',  width: '1110px' }} />
</div>
```

Every child gets `flexShrink: 0` — not as residue but as a **system
invariant**: in Paper, nothing ever shrinks. The parent gets
`overflow: clip` so an over-full line clips instead of renegotiating
anyone's size. Their WYSIWYG contract is those two rules together.

Neither tool constrains the draw itself, which is what the superseded
plan proposed. Paper's export is evidence that the `flex-shrink: 0`
instinct was right — the problem was applying it as one-off draw-time
residue instead of a legible rule, and spelling Fill in a way that
fights it.

## The contract

Four rules. Each is independently useful; together they make drawn
boxes, fixed sizes, and Fill stop being enemies.

### Rule 1 — Draw freely

No free-space gating, no size clamp against the parent inside flex
parents. Draw any size, anywhere in the parent. `MIN_SIZE` (20px) still
floors the result; non-flex (absolute-positioning) parents keep today's
`clampToParent` behaviour unchanged.

### Rule 2 — Fixed-in-flex means `flex-shrink: 0`, derived not stored

A flex child whose **main-axis** mode is `fixed` (row parent → width,
column parent → height) gets `flex-shrink: 0` emitted **by the
generator**, the way Paper does — a rule you can predict from the
panel, not a property left behind by a gesture.

Derived, not stored: `preserveDrawnSize` (which wrote it into
`customProperties` at draw time) is deleted. The generator emits it
from the model (`parent is flex` + `main axis fixed`), and `parseCode`
absorbs a matching `flex-shrink: 0` back into that expectation instead
of routing it to `customProperties` — same typed-echo dedupe rule the
codebase already uses (`docs/notes/typed-property-echo.md`). Existing
files with the draw-time residue self-heal on their next save. Any
OTHER `flex-shrink` value stays a verbatim custom property, untouched.

Consequences worth stating: `flex-shrink` only affects the main axis,
so cross-axis fixed sizes need nothing. Text, hug, and auto children
are not guarded — they shrink and wrap like the browser, which is what
a hand-coder expects of them. And because the guard is derived,
switching the axis away from `fixed` removes it automatically —
`releaseDrawnSize` becomes unnecessary rather than re-landed.

### Rule 3 — Fill on the flex main axis means `flex: 1`, not `width: 100%`

The root cause of the sidebar bug. Scamp spells Fill as `width: 100%` —
a *shrink-based* fill (basis = whole container, shrink down to the
remainder), which is why it dies the moment anything sets
`flex-shrink: 0`. A hand-coder writes **`flex: 1`** — a *grow-based*
fill (basis 0, grow into the remainder) — which is indifferent to
every sibling's shrink settings and is the idiomatic CSS for exactly
this layout.

- Row parent, `widthMode: 'stretch'` → emit `flex: 1;` (was
  `width: 100%`).
- Column parent, `heightMode: 'stretch'` → emit `flex: 1;` (was
  `height: 100%`, which was already mushy against an indefinite
  container height).
- Cross-axis Fill is NOT touched by this plan: column-parent
  `width: 100%` keeps working and stays (documented asymmetry,
  `docs/notes/canvas-cross-axis-stretch.md`); row-parent fill-height is
  the parked half of reverted `f4fe569` — see Q5.
- Non-flex parents: `100%` emission unchanged.

Parsing: exactly `flex: 1` (whitespace-normalised) on a flex child maps
to the main-axis stretch mode. Every other `flex`/`flex-grow`/
`flex-basis` spelling passes through `customProperties` verbatim, and —
because the canvas renders the injected stylesheet — still renders
correctly on canvas. Narrow on purpose; widen later if agent-written
files show common variants.

**Prior art to clear first:** `docs/notes/canvas-flex-main-axis-stretch.md`
argues against `flex: 1` — but its argument is that the canvas diverged
from a file that said `width: 100%`. If the FILE says `flex: 1`, the
canvas mirroring it is the fix. Phase 0 verifies this with
measurements, not readings.

### Rule 4 — Overflow resolves by the parent's sizing mode

- **Hug (`fit-content`) parent → it grows.** This is Figma's behaviour
  and it is also just… CSS. With rule 1 removing the clamp, the browser
  does this on its own; the canvas mirrors it. No code.
- **Fixed parent → visible overflow.** The child sticks out, exactly as
  in a browser. We do NOT auto-apply `overflow: clip` (Paper's choice):
  silently hiding content in generated code is a trap someone finds in
  production. Clip remains something the user sets on the container
  deliberately.
- Follow-up, not v1: extend the canvas overflow indicator (today
  root-level) to flag over-full nested containers.

## Phase 0 — the spike (before any code)

An Electron measurement script, same discipline as this week's checks:

1. `flex: 1` next to a fixed `flex-shrink: 0` sibling — remainder in
   both canvas-equivalent DOM and plain browser DOM. Re-test the exact
   scenario `canvas-flex-main-axis-stretch.md` was written about, with
   the file spelling `flex: 1`.
2. Two Fill children → equal split under both spellings.
3. Over-full line: fixed+guarded children with one `flex: 1` child →
   the fill child floors at 0 (basis 0 cannot go negative) — confirm
   and accept, or note for the nested-overflow indicator.
4. Hug parent + oversized drawn child → parent grows identically on
   canvas and in a plain browser page.

The spike's numbers go into the plan before phase 1 starts. If (1)
shows a real divergence the note was right about, rule 3 is
re-designed, not forced.

## Phases

1. **Rule 3 generator + parser.** `flex: 1` emission for main-axis
   stretch; parse mapping; round-trip fixtures including agent-written
   variants passing through untouched. The invariant test gets a
   main-axis-fill element in a flex parent.
2. **Rule 2.** Generator emission of the derived guard; parse
   absorption + typed-echo dedupe; delete `preserveDrawnSize` and its
   wiring; migration test proving a file with draw-time residue
   self-heals byte-stably.
3. **Rule 1 + 4.** Remove the flex-parent size clamp from
   `useDrawInteraction`; hug-parent growth and fixed-parent overflow
   are browser behaviour — cover with rendered-geometry e2e, no new
   rendering code expected.
4. **E2e rewrite.** `draw-into-flex.spec.ts` re-asserted around the
   contract (guard present for fixed children *from the generator*,
   absent for hug/text; drawn size renders exactly, including into a
   full line; hug parent grows). Resurrect the sidebar+main acceptance
   spec from `f4fe569` with `flex: 1` expectations — the rendered
   `root.w - 287` assertion stays, since CSS-level assertions passed
   through every one of this week's bugs.

Insertion-index-from-draw-position (from the superseded plan) is kept
as an idea but split out — see Q6.

## What this plan does NOT touch

- Fill-height in a row parent (`align-self: stretch`, the other half of
  `f4fe569`) — parked until the revert investigation closes (Q5).
- Grid parents, `flex-wrap` parents — today's behaviour.
- Existing files beyond the two self-healing migrations named above.
- The "don't shrink" UI toggle — with rule 2 the guard is derived, so
  the toggle becomes "why is my fixed box guarded" documentation
  instead of a control; dropped unless you still want it.

## Open questions

1. **Rule 2 scope check.** Fixed-main-axis children get the guard even
   when the line has plenty of room (where it is inert). Paper does
   exactly this and it makes the output predictable, but every fixed
   flex child in every export now carries `flex-shrink: 0`. Comfortable
   with that as the house style of Scamp-generated code?

2. **`min-width: 0` alongside `flex: 1`?** Without it, a fill child's
   content (long text, wide image) can force it past the remainder —
   the classic flexbox text-overflow gotcha. Hand-coders add it when
   they hit it. Emit it always (safe, one extra line), or leave it to
   the user (purer)? I lean emit.

3. **Fixed-parent overflow affordance, v1.** Visible overflow with no
   indicator (honest but silent), or is the nested overflow indicator
   worth pulling into this plan rather than follow-up?

4. **Parse narrowness.** Only exact `flex: 1` maps to Fill; `flex: 1 1 0%`,
   `flex-grow: 1`, etc. pass through as custom properties (rendering
   correctly, but the Size panel shows the axis as Auto rather than
   Fill). Acceptable for v1?

5. **The parked fill-height half of `f4fe569`.** Did your investigation
   reach a verdict on what broke? If it was the fill-height/`align-self`
   change, this plan lets it stay dead. If it was the `releaseDrawnSize`
   half (now unnecessary), fill-height could be re-proposed separately.

6. **Insertion index from draw position** (draw between two children →
   land between them). Keep bundled here as a phase 5, or split into
   its own plan?
