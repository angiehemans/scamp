# The flex sizing contract — Plan

Status: **questions answered, decisions folded in below.** Next action
is Phase 0 (measurement spike); no repo code changes until its numbers
are in this doc and Angie has seen them.

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
   commit `f4fe569`, reverted in `7238e00` after an unexplained canvas
   break.

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
anyone's size.

And for the exact layout that started this week — fixed sidebar, main
filling the remainder — Paper writes:

```jsx
<div style={{ display: 'flex', gap: 16, height: '832px', overflow: 'clip',
              alignItems: 'start', padding: '16px', width: '1280px' }}>
  <div style={{ alignSelf: 'stretch', flexShrink: '0', width: '342px' }} />
  <div style={{ alignSelf: 'stretch', flex: 1 }} />
</div>
```

That is this plan's contract verbatim: `flex: 1` for Fill, the shrink
guard on the fixed axis and nowhere else, and `align-self: stretch`
with NO height for fill-height — even though their parent has a
definite height where `height: 100%` would have worked. It is their
general rule, not a workaround.

The one place Scamp deliberately diverges from Paper: no automatic
`overflow: clip`. Silently hiding content in generated web code is a
trap someone finds in production; clip stays a deliberate user choice.

## The contract

Four rules. Each is independently useful; together they make drawn
boxes, fixed sizes, and Fill stop being enemies.

### Rule 1 — Draw freely

No free-space gating, no size clamp against the parent inside flex
parents. Draw any size, anywhere in the parent. `MIN_SIZE` (20px) still
floors the result; non-flex (absolute-positioning) parents keep today's
`clampToParent` behaviour unchanged.

### Rule 2 — Fixed-in-flex means `flex-shrink: 0`, derived not stored

*(Decided: yes — Q1.)*

A flex child whose **main-axis** mode is `fixed` (row parent → width,
column parent → height) gets `flex-shrink: 0` emitted **by the
generator**, the way Paper does — a rule you can predict from the
panel, not a property left behind by a gesture. Every fixed flex child
in every export carries it; that is now the house style of
Scamp-generated code.

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

### Rule 3 — Fill emits the idiomatic spelling for its context

*(Expanded per Q5: Fill is smart on BOTH axes, for every parent
context — non-layout, flex row, flex column, grid. This absorbs the
fill-height half of reverted `f4fe569`, which Paper's export
independently validated, instead of leaving it parked.)*

The root cause of the sidebar bug: Scamp spelled every Fill as `100%` —
a *shrink-based* fill in flex contexts, which dies the moment anything
sets `flex-shrink: 0`, and a collapse-to-zero in the fill-height case.
A hand-coder picks the spelling per context. So does Fill now:

| Parent context | Fill **width** emits | Fill **height** emits |
|---|---|---|
| Non-layout (absolute positioning) | `width: 100%` *(unchanged)* | `height: 100%` *(unchanged — resolves against the positioned parent)* |
| Flex **row** | **main:** `flex: 1;` + `min-width: 0;` | **cross:** `align-self: stretch;`, no height *(the `f4fe569` / Paper spelling)* |
| Flex **column** | **cross:** `width: 100%` *(unchanged — resolves against a definite inline size AND preserves the parent's `align-items`; see `docs/notes/canvas-cross-axis-stretch.md`)* | **main:** `flex: 1;` + `min-height: 0;` |
| Grid | *spike decides* — candidates: `width: 100%` vs `justify-self: stretch` | *spike decides* — candidates: `height: 100%` vs `align-self: stretch` (auto rows make percentages mushy) |

- `min-width: 0` / `min-height: 0` ride along with `flex: 1`
  *(decided: emit — Q2)* so a fill child's content can never force it
  past the remainder — the classic flexbox text-overflow gotcha,
  pre-solved instead of discovered.
- The grid row of the matrix is filled by Phase 0 measurements, not by
  reasoning — grid's default `stretch` alignment and auto-track
  percentage behaviour are exactly the kind of thing this week proved
  we should measure first.
- The `align-self: stretch` emission is guarded on the default
  `alignSelf` so a user-set alignment is never contradicted by a second
  line (same guard `f4fe569` carried).

**Parsing (decided: narrow — Q4).** Emission is as the matrix says.
Reading files back: the exact spellings the matrix emits map to Fill
mode (including existing `height: 100%` / `width: 100%` files — see
migration below); other people's spellings (`flex: 1 1 0%`,
`flex-grow: 1`, …) pass through `customProperties` verbatim. They still
render correctly on canvas because the canvas renders the injected
stylesheet — the only cost is the Size panel reading "Auto" instead of
"Fill" for those. Widen later if agent-written files show common
variants.

To answer the question asked inline at Q4 directly: yes — for flex
children, Fill on the main axis emits `flex: 1` instead of
`width: 100%`. Q4 was only about how many foreign spellings we
*recognize on read*, and the answer is: just our own, for v1.

**Prior art to clear first:** `docs/notes/canvas-flex-main-axis-stretch.md`
argues against `flex: 1` — but its argument is that the canvas diverged
from a file that said `width: 100%`. If the FILE says `flex: 1`, the
canvas mirroring it is the fix. Phase 0 verifies this with
measurements, not readings. Paper emits exactly `flex: 1` here, with no
shrink guard on the fill child — external convergence, but still
measured before trusted.

### Rule 4 — Overflow resolves by the parent's sizing mode

*(Decided: visible overflow, no new indicator in v1 — Q3.)*

- **Hug (`fit-content`) parent → it grows.** Figma's behaviour, and
  also just CSS. With rule 1 removing the clamp, the browser does this
  on its own; the canvas mirrors it. No code.
- **Fixed parent → visible overflow.** The child sticks out, exactly as
  in a browser. No auto-`overflow: clip`, no v1 indicator.
- Follow-up: extend the canvas overflow indicator (today root-level) to
  flag over-full nested containers.

## Migration — the open decision Phase 0 must close

The reverted `f4fe569` broke something on the canvas that was never
diagnosed. The prime suspect is its migration: existing
`height: 100%` elements parse as Fill, so the first save re-emitted
them as `align-self: stretch`, shifting any layout that leaned on the
old collapsed rendering.

Rule 3 re-introduces that migration — plus a new one (`width: 100%` →
`flex: 1` for main-axis fill). Two candidate strategies:

- **Eager:** parse old spellings as Fill; next save rewrites them to
  the matrix. Files self-heal; layouts that depended on broken
  behaviour change.
- **Lazy:** old spellings round-trip byte-stably (parsed as
  fixed-with-custom-value, or a preserved-spelling flag); only a NEW
  Fill choice, or touching that axis in the panel, emits the matrix
  spelling.

Phase 0 decides with evidence instead of taste: apply the candidate
emissions to the real `scamp-ui` pages (`new-layout`, `test`,
`start-page`) and diff rendered geometry element-by-element against
today's rendering. If the diffs are all "broken layouts becoming what
the user meant" (invisible sidebars appearing, overflowing mains
snapping to the remainder), eager is right and the `f4fe569` break gets
an explanation on the record. If something defensible moves, lazy wins.

## Phase 0 — the spike (before any code)

An Electron measurement script, same discipline as this week's checks.
Numbers go into this doc before phase 1 starts.

1. `flex: 1` next to a fixed `flex-shrink: 0` sibling — remainder in
   both canvas-equivalent DOM and plain browser DOM. Re-test the exact
   scenario `canvas-flex-main-axis-stretch.md` was written about, with
   the file spelling `flex: 1`. If a real divergence appears, rule 3 is
   re-designed, not forced.
2. Two Fill children → equal split under both spellings.
3. Over-full line: fixed+guarded children with one `flex: 1` child →
   the fill child floors at 0 (basis 0 cannot go negative) — confirm
   and accept as visible-overflow behaviour per rule 4.
4. Hug parent + oversized drawn child → parent grows identically on
   canvas and in a plain browser page.
5. **Grid matrix cells:** fill width/height in fixed tracks, `auto`
   tracks, and `fr` tracks, under both candidate spellings, canvas vs
   browser. Winners go into the rule 3 table.
6. **Migration diff:** candidate emissions applied to the real
   `scamp-ui` pages, rendered geometry diffed against today — closes
   the eager/lazy decision and, ideally, names what `f4fe569` actually
   broke.

## Phases

1. **Rule 3 generator + parser** — the full matrix as settled by the
   spike; round-trip fixtures including foreign spellings passing
   through untouched; the invariant test gains a main-axis-fill and a
   cross-axis-fill element in flex parents.
2. **Rule 2** — generator emission of the derived guard; parse
   absorption + typed-echo dedupe; delete `preserveDrawnSize` and its
   wiring; migration test proving a file with draw-time residue
   self-heals byte-stably.
3. **Rules 1 + 4** — remove the flex-parent size clamp from
   `useDrawInteraction`; hug-parent growth and fixed-parent overflow
   covered with rendered-geometry e2e; no new rendering code expected.
4. **E2e rewrite** — `draw-into-flex.spec.ts` re-asserted around the
   contract (guard present for fixed children *from the generator*,
   absent for hug/text; drawn size renders exactly, including into a
   full line; hug parent grows). Resurrect the sidebar+main acceptance
   spec from `f4fe569` with matrix expectations — the rendered
   `root.w - 287` assertion stays, since CSS-level assertions passed
   through every one of this week's bugs.
5. **Insertion index from draw position** *(decided: bundled — Q6)* —
   draw between two children, land between them, reusing the
   drag-reparent index logic. Last, because it is independent of the
   sizing rules and must not gate them.

## What this plan does NOT touch

- `flex-wrap` parents — today's behaviour.
- Existing files beyond the migrations named above (whose strategy
  Phase 0 decides).
- The "don't shrink" UI toggle — with rule 2 the guard is derived;
  dropped unless wanted later.
- Automatic `overflow: clip` — rejected deliberately, see Context.

## Decisions log (was: open questions)

1. Guard on every fixed flex child, Paper-style house rule — **yes**.
2. `min-width/min-height: 0` alongside `flex: 1` — **emit**.
3. Fixed-parent overflow in v1 — **visible, no indicator**.
4. Parse narrowness — **narrow**; emission per the matrix, foreign
   spellings pass through. (And yes: Fill in flex = `flex: 1`, not
   `width: 100%`.)
5. Fill is context-smart on both axes, including grid — **in scope**;
   grid spellings and migration strategy settled by Phase 0
   measurements.
6. Insertion index — **bundled**, as phase 5.
