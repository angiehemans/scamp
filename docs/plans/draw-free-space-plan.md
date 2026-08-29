# Drawing into flex parents: free-space drawing — Plan

Status: draft, awaiting answers to the open questions at the bottom.

## Context

Drawing a rectangle into a flex parent has been fixed four times this
week, at four layers, and the fixes have been fighting each other:

1. The clamp shrank the drawn width to `parentW - x` (the 20px bug) —
   fixed with `clampSizeToParent`.
2. The clamp then read the parent's MODEL size, which is a meaningless
   100 for stretch/auto parents — fixed by measuring.
3. The drawn box then rendered smaller than its own CSS said, because a
   full flex line shrinks its items — fixed by auto-adding
   `flex-shrink: 0` on every draw (`preserveDrawnSize`).
4. That leftover `flex-shrink: 0` then broke Fill width — a basis-100%
   item that cannot shrink overflows the container by exactly its
   sibling's width. The fix (`releaseDrawnSize`, commit `f4fe569`) was
   reverted in `7238e00` pending investigation.

Each fix was real, and each existed because of the one before it. The
root problem is upstream of all of them: **Scamp lets you draw a box
into space that is not actually there.** The flex line then has to
resolve the over-commitment, and whatever it does — shrink the new box,
shrink a sibling, overflow — reads as a bug.

The proposal (Angie's): constrain the draw itself. Inside a flex parent,
the drawable region is the parent's **free space** — the area not
occupied by existing children. The rectangle can be any size within
that region; it cannot exceed the parent and cannot overlap a sibling.
The drag stops at a sibling's edge like a wall.

## Why this dissolves the problem instead of patching it

Flex shrinking only engages when a line is over-full. If every draw is
clamped to space that genuinely exists, the line is never over-full at
draw time, shrink never engages, and the drawn box keeps its size **by
construction** — exactly like the hand-written `width: 400px` div it is
supposed to feel like. No `flex-shrink: 0` needed, no residue to clean
up on a mode switch later, and nothing to fight Fill width.

`preserveDrawnSize` is removed under this plan. `flex-shrink: 0`
becomes something a user adds on purpose (see "Follow-up" below), not
something the tool leaves behind.

## The second thing this fixes: where the box lands

Today a draw appends to the end of the parent's `childIds`, so you can
draw in one place and watch the committed box land wherever layout puts
the last child. Under this plan the free-space region you started the
drag in determines the **insertion index**: draw in the gap between
child 1 and child 2, land between child 1 and child 2. The gesture
means what it looks like it means.

The drag-reparent code already derives insertion indices from pointer
position; the draw path reuses that logic rather than growing its own.

## What already exists

- `measureElementInFrame` — sibling geometry in logical (pre-zoom) px,
  via the offsetParent chain, transform-free.
- `clampSizeToParent` — becomes "clamp to the free rect" with different
  bounds fed in.
- Drop-placement index logic in the drag-reparent interaction.
- `DrawPreview` — needs to render the clamped rect live so the preview
  visibly stops at a sibling's edge instead of passing through it.
- `MIN_SIZE` (20px) — the existing floor; a free region smaller than
  this on either axis is not drawable.

## New pieces

### `freeSpace` (pure, `src/renderer/lib/freeSpace.ts`)

Given the parent's content box (minus padding), its `gap`, its
direction, and the boxes of its existing children, return the list of
free regions along the main axis, each with its insertion index:

```
regions: Array<{
  index: number;      // childIds insertion position
  x: number; y: number; w: number; h: number;  // logical px
}>
```

Rules:

- Each region's main-axis extent is reduced by the `gap` the new child
  will introduce (one gap when inserting between/after children, none
  in an empty parent).
- Cross-axis extent is the parent's content-box cross size (the box may
  be drawn shorter; it just can't be taller/wider than the parent).
- Regions smaller than `MIN_SIZE` on the main axis are dropped.
- Pure function, fully tested: row/column, gaps, padding, empty parent,
  full parent (no regions), single child at each edge, fractional
  sibling sizes.

### Draw gating + live clamp (`useDrawInteraction`)

- On draw start inside a flex parent: hit-test the pointer against the
  free regions. In a region → begin the draw, remember its bounds and
  insertion index. On a child → existing behaviour (containers nest;
  see Q3). No region → see Q1.
- During the drag: clamp the preview rect to the region's bounds on
  both axes.
- On commit: `createRectangle` (and image/svg/input) accept an
  insertion index instead of always appending; x/y stay zeroed for
  layout parents as they do today.

### Removal

- `preserveDrawnSize` and its call sites in `elementsCreate.ts`; its
  tests become tests of the new behaviour (a draw into a flex parent
  emits NO flex-shrink).
- The e2e specs that assert `flex-shrink: 0` in generated CSS
  (`draw-into-flex.spec.ts`) flip to asserting its absence, and the
  rendered-size assertions stay — they are the ones that catch what CSS
  assertions miss.

## What this plan does NOT touch

- **Fill height / `height: 100%` / `align-self: stretch`** — the other
  half of reverted `f4fe569`. Separate decision, still parked pending
  your investigation.
- **Non-flex parents** — absolute positioning keeps today's
  `clampToParent` behaviour unchanged.
- **Grid parents** — a grid item is placed and sized by its tracks;
  free-space drawing there is a different (harder) geometry problem.
  Today's behaviour stays.
- **Existing files** — nothing migrates. Elements that already carry
  `flex-shrink: 0` keep it; it is visible and deletable in the CSS
  panel.

## Phases

1. **`freeSpace` lib + tests.** Pure geometry, no UI. The bulk of the
   correctness risk lives here and is unit-testable.
2. **Gating + clamp + preview.** Wire into `useDrawInteraction` and
   `DrawPreview`. Remove `preserveDrawnSize`.
3. **Insertion index.** Thread through `createRectangle` /
   `createImage` / `createSvgElement` / `createInput`.
4. **E2e.** Rewrite `draw-into-flex.spec.ts` around the new model:
   draw in the end gap, draw between two children (index respected),
   drag clamps at a sibling edge, full parent (per Q1), rendered size
   equals drawn size with no flex-shrink emitted. All rendered-geometry
   assertions, mutation-checked as usual.

## Follow-up (separate, not in this plan)

A "don't shrink" toggle in the Size section — an explicit, discoverable
way to write `flex-shrink: 0` when refining a layout, sibling to the
ratio lock. Worth its own small plan once this lands.

## Open questions

1. **Full parent (or every region under 20px): the draw gesture finds
   no drawable space.** Plain no-op, or an affordance — cursor change,
   brief toast, a flash on the parent's boundary? A silent no-op is
   honest but can read as "the tool is broken".

2. **`justify-content` repositioning.** With `center` /
   `space-between` / `flex-end`, the committed box keeps its drawn size
   but the whole row redistributes, so it may not sit exactly where you
   drew it. Accept this as honest flexbox, or restrict free-space
   drawing to start-packed rows in v1?

3. **Drawing on top of an existing child that is a container** starts a
   draw INSIDE that child today (that is how you nest). Keep that, with
   free-space rules applying only when the flex parent itself is the
   deepest hit? (Recommended: yes.)

4. **Hug (`fit-content`) flex parents** grow when children are added,
   so "no larger than the parent" is ill-defined. V1 proposal: hug
   parents keep today's behaviour (append, no free-space gating), and
   only fixed/fill/auto-sized parents get the new model. OK?

5. **`flex-wrap` parents.** Free space per line is real complexity.
   V1 proposal: wrap parents keep today's behaviour. OK?

6. **The reverted commit.** This plan removes the need for
   `releaseDrawnSize` going forward (nothing auto-adds `flex-shrink: 0`
   anymore), but the fill-height half of `f4fe569` is independent and
   still parked. Does your investigation want it re-proposed
   separately, or dropped for now?
