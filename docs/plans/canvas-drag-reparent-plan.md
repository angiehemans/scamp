# Plan — Canvas drag-to-reparent (Bug 2)

## Problem

On the canvas you cannot drag an element **into another element** (reparent).
The symptom users hit: with a flex layout applied, dragging an element "into
another" does nothing — the element doesn't even appear to move.

### Why (root cause)

`CanvasInteractionLayer.handlePointerDown` routes a drag to one of two
state machines, neither of which ever changes an element's parent:

- **Non-flex child** → `useMoveInteraction`. Updates x/y only, and
  **clamps the element inside its current parent**
  (`useMoveInteraction.ts:66-68`). It physically can't leave its parent.
- **Flex child** → `useReorderInteraction`. Reorders within the **same**
  parent's sibling list (`useReorderInteraction.ts:54, 117-122`). Flex
  owns the child's position, so the element doesn't follow the cursor;
  and if the cursor isn't over a *sibling*, `hitSiblingId` stays null →
  no drop indicator → drop is a no-op (`:68-73`). Dragging toward a
  different container reads as "won't drag."

Reparenting today exists **only in the Layers panel** (drag a row
"inside" another — `test/e2e/layers-panel/reorder-dnd.spec.ts:135`).

### What already exists (reuse these)

- **`reorderElementPure(elements, id, newParentId, newIndex)`**
  (`src/renderer/lib/element/tree.ts:55`) already performs cross-parent
  moves, including a **cycle check** (can't drop into yourself or a
  descendant). It does **not** touch x/y.
- Store action **`reorderElement(id, newParentId, newIndex)`**
  (`elementsCreate.ts:700`) wraps it and commits one `reorder` history
  entry. The Layers panel calls it with a *different* parent already.
- Geometry helpers in `useCanvasGeometry`: `toFrame`,
  `measureElementInFrame`, `parentMoveBoundsOf`, `isFlexChild`.
- Hit-testing: `hitTest` in `canvasHitTest.ts` (+ `document.elementsFromPoint`
  pattern used by the reorder hook to walk stacked nodes).

So the **store can already reparent**; the gap is entirely in the canvas
*interaction* layer (detecting the drop container + committing a reparent),
plus setting x/y when the new parent is absolutely-positioned.

---

## Goal & scope

**Goal:** dragging an element on the canvas and releasing over a different
container reparents it into that container, with clear drop feedback.

**In scope**
- Reparent into a **flex/grid container** → insert at the cursor's position
  in the sibling flow (reuse the existing drop-index logic).
- Reparent into an **absolute (non-flex) container** → reparent **and**
  set the element's x/y to the drop point in the new parent's local space.
- Reparent **out** to the page root (root is an absolute container).
- A drop-target highlight (container outline) + the existing flex gap line.

**Non-goals (this pass)**
- Multi-element reparent (keep single-element; selection already collapses
  to a primary for drag).
- Auto-converting a target into a flex container on drop.
- Reparenting component-instance internals (treat an instance as opaque —
  see Edge cases).

---

## Interaction model (decision needed — see Open questions)

Proposed default (Figma-like):

1. Pointer down on a non-root element starts a **unified drag**.
2. During the drag, hit-test the element stack under the cursor for the
   **deepest valid drop container** that is not the dragged element, not
   its descendant, and not a non-container leaf (text/input/image).
3. Feedback:
   - Target is the **current parent** → behave as today (move x/y, or flex
     reorder with the gap line). No reparent.
   - Target is a **different flex/grid container** → show the sibling **gap
     line** at the computed insert index (reuse reorder's math).
   - Target is a **different absolute container** → highlight the container
     **outline**; the element will land at the cursor point.
4. On release, commit:
   - Same parent → existing move/reorder commit.
   - New flex/grid parent → `reorderElement(id, newParentId, insertIndex)`.
   - New absolute parent → reparent **and** set x/y (new action, below).

Whether reparent is **always-on** (drop over any container reparents) or
**modifier-gated** (e.g. hold a key to reparent, otherwise move within
parent) is the main UX decision — see Open questions.

---

## Architecture changes

### 1. A drop-container resolver (new geometry helper)

Add to `useCanvasGeometry` (or a new `interactions/useDropTarget.ts`):

```
resolveDropContainer(clientX, clientY, draggedId): {
  parentId: string;
  isFlow: boolean;        // flex/grid → use insert index; else absolute
} | null
```

- Walk `document.elementsFromPoint` top→bottom (skip the chrome layer via
  `data-canvas-chrome`, skip the dragged element + its subtree).
- Pick the first node whose `dataset.elementId` maps to a **container**
  (an element that can hold children — a `div`-like, not text/input/image).
- Reject if it's the dragged element's descendant (defense-in-depth; the
  pure fn also cycle-checks).
- `isFlow = display === 'flex' || display === 'grid'`.

### 2. Unify the drag entry (CanvasInteractionLayer)

Replace the hard either/or in `handlePointerDown` (`:118-122`) so a single
drag can transition between "move/reorder within parent" and "reparent."
Two viable shapes:

- **(A) Extend `useMoveInteraction`** to, on each move, resolve the drop
  container; if it differs from the current parent, suppress x/y clamping
  and show reparent feedback; commit a reparent on end. Keep
  `useReorderInteraction` for same-parent flex reordering, or fold it in.
- **(B) New `useReparentInteraction`** that owns cross-parent drags and
  delegates to move/reorder when the target is the current parent.

Recommend **(A)** to avoid a third overlapping state machine, but the
reorder hook's gap-line math should be extracted into a shared helper so
both same-parent and cross-parent flow drops reuse it.

### 3. Store: reparent-with-position (new pure fn + action)

`reorderElementPure` ignores x/y, so dropping into an absolute container
would keep stale coordinates. Add a sibling pure helper in
`lib/element/tree.ts` (fully unit-tested per CLAUDE.md — `lib/` is
mandatory coverage):

```
reparentWithPositionPure(elements, id, newParentId, index, x, y)
  → Record<id, ScampElement> | null
```

= `reorderElementPure` + set `{ x, y }` on the moved element. Then a store
action `reparentElement(id, newParentId, index, pos?)` that commits **one**
history entry (`kind: 'reorder'` or a new `'reparent'`). For flow targets,
`pos` is omitted and it falls back to `reorderElement`.

### 4. Drop feedback rendering

- Flex/grid gap line: already rendered from `reorder.dropIndicator`
  (`CanvasInteractionLayer.tsx:215-225`) — reuse.
- Absolute container highlight: add a thin outlined rect from a new
  `dropContainerRect` (measured via `measureElementInFrame(parentId)`).

---

## Edge cases

- **Drop into self / descendant** → forbidden (pure fn cycle-checks;
  resolver also excludes the dragged subtree). No-op, no history entry.
- **Root as target** → allowed; root is absolute, so set x/y in root space.
- **Flex child dragged out to an absolute parent** → must gain sensible
  x/y (it had none meaningful under flex) — use the drop point.
- **Absolute child dragged into flex** → x/y becomes irrelevant; flex owns
  layout. Leave stale x/y (ignored) or zero it — zero it for cleanliness.
- **Non-container leaves** (text / input / image) are never drop targets.
- **Component instances**: an instance is opaque on the page — don't allow
  dropping *into* its internals. Treat the instance element itself as a
  normal child that can be reparented, but not as a container. (Confirm
  against how instances expose `childIds`.)
- **No-op drop** (released over current parent at same index) → no history
  entry, matching current move/reorder behavior.
- **Generated code**: reparent must move the JSX subtree under the new
  parent's tag and rewrite the CSS-module class nesting — already proven by
  the Layers-panel reparent path (it round-trips through `generateCode`),
  so no new codegen work, just the same `reorderElement` outcome.

---

## Files to touch

- `src/renderer/src/canvas/CanvasInteractionLayer.tsx` — unified drag
  routing + drop-container feedback.
- `src/renderer/src/canvas/interactions/useMoveInteraction.ts` (extend) and
  `useReorderInteraction.ts` (extract shared gap-line math; maybe fold in).
- `src/renderer/src/canvas/interactions/useCanvasGeometry.ts` (or new
  `useDropTarget.ts`) — `resolveDropContainer`.
- `src/renderer/lib/element/tree.ts` — `reparentWithPositionPure`.
- `src/renderer/store/canvas/slices/elementsCreate.ts` — `reparentElement`
  action; `canvasSlice.ts` type.
- CSS module — drop-container highlight style.

---

## Tests

**Unit (mandatory — `lib/`):** `test/reparentWithPositionPure.test.ts`
- reparents across parents; sets x/y; rejects self/descendant (cycle);
  rejects root-as-element; index clamping; out-of-flex gains x/y.

**E2E (the currently-missing coverage):** new
`test/e2e/canvas/drag-reparent.spec.ts`
- Drag an absolute element into another absolute container → asserts new
  nesting in the written TSX (mirror `reorder-dnd.spec.ts:160-168`) and the
  new x/y.
- Drag an element **into a flex container** on the canvas → asserts it
  becomes a flex child at the expected index. (This is the exact scenario
  from the bug report and has **no** coverage today.)
- Drag a flex child **out** to root → becomes absolute with x/y.
- Negative: drag onto own descendant → no change.

Use the pointer-based `dragInFrame` helper (`test/e2e/fixtures/canvas.ts`)
since this is real canvas pointer dragging, not HTML5 DnD.

---

## Phasing

1. **Pure + store** (`reparentWithPositionPure`, `reparentElement`) + unit
   tests. No UI yet — fully testable in isolation.
2. **Resolver + feedback** (`resolveDropContainer`, drop highlight) behind
   the existing drag, reparent into **absolute** containers only.
3. **Flow targets** (flex/grid insert index) by extracting the reorder
   gap-line math and reusing it for cross-parent flow drops.
4. **E2E** for all four scenarios; polish feedback.

Each phase is shippable and independently testable.

---

## Open questions (decide before building)

1. **Always-on vs modifier-gated reparent.** Figma reparents on drop into
   whatever frame is under the cursor (always-on). Scamp's current move
   clamps to parent, so always-on is a behavior change (you could no longer
   drag an element partly over a sibling without reparenting). Options:
   (a) always-on like Figma; (b) reparent only when the drop target fully
   *contains* the cursor and differs from the current parent; (c) hold a
   modifier to reparent. **Recommendation: (b)** — natural and low-surprise.
2. **History entry kind** — reuse `'reorder'` or add `'reparent'` for a
   clearer history-panel label? (Cosmetic; `'reparent'` reads better.)
3. **Grid containers** — treat like flex (insert index) or like absolute
   (x/y)? Grid placement is more complex; simplest first pass is to treat
   grid as a flow container with append-to-end, refine later.
4. **Multi-select reparent** — out of scope here; confirm that's acceptable.
