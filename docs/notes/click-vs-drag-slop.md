# A click on a flex child used to reorder it

Reported against the packaged macOS build: clicking an item in a flex
parent pushed it to the **end** of that parent, and clicking the last
item sometimes lifted it **out** of the parent into a sibling position.

## The mechanism

`CanvasInteractionLayer`'s pointer-down on a flow child does two things:
selects it, then calls `reorder.start(...)`. That is correct — a flex
child can only be dragged by reordering — but neither
`useReorderInteraction` nor `useMoveInteraction` had a movement
threshold. `CLICK_DRAG_THRESHOLD` existed and was used **only** by
`useDrawInteraction`.

So the gesture ran to completion on a click:

1. `pointerdown` → `reorder.start`, gesture live.
2. A single `pointermove` → `onMove` resolves a drop target.
3. `pointerup` → `onEnd` commits it.

Step 2 is the whole bug. A mouse click usually emits no `pointermove`,
which is why this was invisible in development on Linux. A trackpad tap
almost always emits one or more with sub-pixel jitter — so it reproduced
readily on a Mac and looked like a packaging problem rather than an
input-device one.

## Why the two specific outcomes

Both fall out of drop math that assumes the cursor was moved somewhere
deliberately.

**Jumps to the end.** `flowIndicator` excludes the dragged element from
sibling scanning:

```ts
const siblingIds = parent.childIds.filter((id) => id !== draggedId);
```

On a click the cursor is over the dragged element and nothing else —
flex siblings don't overlap — so `hitSiblingId` is null and the append
fallback returns `newIndex: parent.childIds.length`. The child goes
last. Clicking the child that is *already* last looks like nothing
happened, which is part of why the report described it as intermittent.

**Escapes the parent.** `besideTargetFor` treats the container's leading
and trailing edge bands (`edgeBandFor`, 6–16px) as "beside this, not
inside it" and retargets the drop to the container's parent. The last
child in a flex row or column sits against the container's trailing
edge, so a click on it lands in that band and the child is reparented
out on release.

## The fix

`DRAG_ARM_DISTANCE` (5px radial, in `interactions/constants.ts`) plus
`hasLeftClickSlop`. Both hooks latch an `armed` ref once the pointer
leaves the slop; below it the gesture owns the pointer but resolves
nothing.

Latched deliberately: dragging back toward the origin mid-gesture must
not disarm, or a drag that loops back through its own start point would
silently stop committing.

The two hooks gate different amounts:

- **Reorder** gates the whole gesture. There is nothing else it does —
  a flex child has no position of its own to nudge.
- **Move** gates only the *reparent* half. Sub-threshold positional
  nudges stay available for precise placement, since a 1px move is a
  legitimate thing to want and is not destructive.

## Testing this

`test/e2e/canvas/drag-reparent.spec.ts` → "canvas: a click is not a
drag". The tests press, move exactly 1px, and release.

Only the *first-child* case discriminates. Clicking the last child is a
no-op under the old code too (it was already last), and a deliberate
drag passes either way — so a green run of the other two proves nothing.
Verify against a pre-fix build if you touch this.

**The e2e suite runs the BUILD** (`out/main/index.js`), not the sources.
`npx playwright test` on its own is `test:e2e:nobuild` and will happily
exercise stale code — this fix appeared to fail, then appeared to pass,
for that reason alone. Run `npm run build` first, or use
`npm run test:e2e`.
