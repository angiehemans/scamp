# Copy and Paste Elements — Plan

**Status:** Draft, awaiting user review. Do not implement until approved.
**Date:** 2026-04-13

## Goal

Let users copy selected elements with Cmd+C and paste them with Cmd+V.
Pasted elements are deep clones with new IDs, inserted as siblings of
the current selection (or children of root if nothing is selected).

---

## Current state

- **Cmd+D** already duplicates the selected element in place via
  `cloneElementSubtree` — deep clone with new IDs, offset by 20px,
  inserted as a sibling right after the original.
- `cloneElementSubtree` handles the full subtree, generates fresh IDs,
  clears the `name` field on clones.
- The sync bridge writes the new elements + CSS to disk on the next
  debounced flush.
- There is no internal clipboard.

---

## Design

### Internal clipboard

Add a `clipboard` field to the canvas store:

```ts
clipboard: {
  /** The element subtree, keyed by the OLD ids. */
  elements: Record<string, ScampElement>;
  /** The root element id of the copied subtree. */
  rootId: string;
} | null;
```

The clipboard stores a **snapshot** of the element subtree at copy time
(deep copy of all fields). It is NOT a reference to the live store — so
the user can copy, modify the original, then paste and get the original
version.

The clipboard persists across selection changes and page switches within
a session, but not across app restarts (not persisted to disk).

### Copy (Cmd+C)

1. Read the primary selected element id.
2. If nothing is selected or the root is selected, do nothing.
3. Deep-copy the selected element and all its descendants from the store
   into the clipboard. Use the existing `cloneElementSubtree` to produce
   the snapshot — but with the ORIGINAL ids (we re-clone with fresh ids
   on paste). Actually simpler: just do a JSON-style deep copy of the
   subtree from the store directly, keyed by the original ids.
4. Store it as `clipboard: { elements, rootId }`.

### Paste (Cmd+V)

1. If clipboard is null, do nothing.
2. Determine the paste target parent:
   - If an element is selected and it's not the root → paste as a sibling
     (same parent as the selected element, inserted right after it).
   - If nothing is selected or the root is selected → paste as a child
     of the root.
3. Call `cloneElementSubtree` on the clipboard's elements with the
   clipboard's rootId, targeting the paste parent. This generates fresh
   IDs for the entire subtree.
4. Insert the cloned subtree into the store (same pattern as
   `duplicateElement` — update parent's childIds, merge cloned elements).
5. Select the pasted root element.
6. The sync bridge writes to disk on the next debounce.

### Cmd+D (duplicate)

Already works. No changes needed — it's a copy+paste in one step with
a 20px offset.

---

## Implementation

### Phase 1 — Store changes

1. Add `clipboard` to `CanvasState` type, default `null`.
2. Add `copyElement(id: string)` action — snapshots the subtree into
   the clipboard.
3. Add `pasteElement()` action — clones from clipboard, inserts at the
   right position, selects the pasted element.

### Phase 2 — Keyboard shortcuts

1. In `ProjectShell.tsx`'s keydown handler, add:
   - `Cmd+C` → `copyElement(selectedId)`
   - `Cmd+V` → `pasteElement()`
2. Guard: skip when editing text (contentEditable) or typing in inputs.

### Phase 3 — Multi-element copy (stretch goal)

The backlog only specifies single-element copy. If the user has multiple
elements selected, copy the primary (first) selected element. Multi-copy
can be added later by storing an array of subtrees in the clipboard.

---

## Files changed

| File | Change |
|---|---|
| `src/renderer/store/canvasSlice.ts` | Add `clipboard`, `copyElement`, `pasteElement` |
| `src/renderer/src/components/ProjectShell.tsx` | Add Cmd+C and Cmd+V keyboard handlers |

No new IPC channels. No new components. No new CSS. The sync bridge
handles file writes automatically.

---

## Edge cases

- **Copy then delete the original** — paste still works because the
  clipboard stores a snapshot, not a reference.
- **Copy on one page, switch pages, paste** — the paste targets the
  current page's root. The clipboard is page-agnostic.
- **Copy a named element** — the clone clears the name (existing
  `cloneElementSubtree` behavior), so the paste gets a default class
  prefix. The user can rename it.
- **Paste when clipboard is empty** — no-op, no error.
- **Copy the root** — no-op, the root can't be copied.

---

## Out of scope

- System clipboard integration (pasting elements between Scamp windows)
- Multi-element copy (copy all selected, not just the primary)
- Copy/paste across projects
- Cut (Cmd+X) — can be added later as copy + delete
