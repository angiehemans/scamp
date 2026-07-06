# Visual History Panel — Plan

**Status:** Draft for review.
**Date:** 2026-05-13
**Source:** `docs/backlog-4.md` story #5
**Related:** Element rename (story shipped — names resolve at
display time, important for retroactive label updates), Element
states (story shipped — overrides need to be captured by per-state
patches), External edit sync (`src/renderer/src/syncBridge.ts` —
the file-watcher path this panel needs to record).

---

## Goal

Replace the current zundo-based "magic undo stack" with a custom
per-page history slice that:

1. Tracks every meaningful canvas mutation as a labelled entry
   (`"Changed background — hero-card_a1b2"`).
2. Surfaces that list in a floating "History" panel where the
   user can click any entry to jump to that point.
3. Keeps Cmd+Z / Cmd+Shift+Z working — they become two of three
   interfaces to the same stack (panel-click is the third).
4. Survives page switches — each page has its own independent
   stack instead of the global one we have today.
5. Coalesces rapid same-property edits (slider drags, drag-to-move)
   into one entry instead of dozens.

Net result: the user can scrub through their session like a video
timeline, see *what* they did (not just step back blindly), and
keep their history when navigating pages.

---

## Current state — what we can build on

- **Zundo `temporal` middleware** in
  `src/renderer/store/canvasSlice.ts:694`. Configured with
  `partialize: (state) => ({ elements: state.elements })`,
  `limit: 50`, and an equality check (`a.elements === b.elements`)
  that suppresses recording when the elements map is replaced
  wholesale (page load). Records a fresh snapshot on every `set()`
  that produces a new elements map. **No per-entry metadata.**
- **Keyboard handlers** in
  `src/renderer/src/components/ProjectShell.tsx:433` (Cmd+Z /
  Cmd+Shift+Z) call `useCanvasStore.temporal.getState().undo()` /
  `.redo()`. The temporal store is exposed via a getter on the
  main store — same shape we'll keep.
- **External-edit sync** in
  `src/renderer/src/syncBridge.ts`. On an external file change
  (`lastLoadKind === 'external'`), the reload runs, then
  `temporal.getState().clear()` wipes both past and future. Story
  spec changes this: external edits become a single
  `External edit detected` entry that clears only the forward
  history, like any other new change.
- **Drag / resize handlers** in
  `src/renderer/src/canvas/CanvasInteractionLayer.tsx`. Each
  `pointermove` tick calls `moveElement(id, x, y)` →
  `set((state) => ({ elements: { ...state.elements, [id]: next } }))`
  → zundo records a new entry. **One drag of a rectangle 50px
  across the canvas creates ~30 history entries today, filling
  the 50-step buffer almost instantly.** This is a latent bug
  the story spec implicitly fixes via the coalesce-on-mouseup
  rule.
- **Action types** are spread across the mutation methods in
  `canvasSlice.ts`:
  - `moveElement` (drag)
  - `resizeElement` (handle drag)
  - `patchElement` (every panel edit)
  - `deleteElement` / `deleteSelected`
  - `addElement` (drew rectangle / added text)
  - `pasteElements` / `duplicateElement`
  - `renameElement`
  - `addPage` / `deletePage` / `renamePage`
  - `commitRawCss` (raw CSS editor commit)
  Each one is a natural commit point — we tag commits at the
  mutation site, not at observation time.
- **Element name resolution.** `classNameFor(el)` in
  `generateCode.ts:97` derives the class name from
  `el.name ? slugify(el.name) : defaultPrefix` + `_${el.id}`.
  History entries store element **IDs**, not names — the panel
  resolves IDs to current names at display time, so a rename
  retroactively re-labels every past entry for that element.
- **Side panel pattern** (`PropertiesPanel.tsx` +
  `PropertiesPanel.module.css`). Standard `<aside>` with a
  header, mode toggle, and scrollable body. The history panel
  mounts as a sibling floating panel rather than a tab inside
  the properties panel because the user wants to see both at
  once.
- **Page id**. The active page is identified by `activePage.tsxPath`
  (the absolute file path). Stable across renames within a
  session — renames update the path in the store atomically. Use
  it as the key for the per-page history map.

What's NOT there yet:

- No per-entry metadata; zundo is opaque.
- No per-page history — switching pages clears the stack
  (`temporal.clear()` is called explicitly on page-switch in
  several places).
- No coalescing.
- No "jump to entry N" API — zundo only steps one at a time.
- No history panel UI.
- The drag/resize handlers don't know about commit points.

---

## Non-goals for this story

- **Branching history.** Story spec is explicit: standard linear
  model, no branches. A new change after some undos discards the
  forward entries, full stop.
- **Cross-session persistence.** Story spec: "History is in-memory
  only — it does not persist between sessions." Closing the app
  forgets the stack. No disk I/O on the history path.
- **Cross-element batch labels.** When the user deletes a group
  of selected elements, the entry says "Deleted [first name]"
  rather than enumerating all of them. Multi-element labels are
  a polish-pass concern.
- **External edit diffing.** Story spec: external edits collapse
  into a single "External edit detected" entry. No attempt to
  characterise *what* the external editor changed — that would
  require a structural diff of the elements map. Out of scope.
- **Animation-frame scrubbing.** Clicking an entry jumps
  instantly to that snapshot. No interpolation, no animation,
  no scrub bar. Just snap-to-state.
- **Undo stack visualisation outside the panel.** We don't show
  toast messages, badges in the toolbar, or other ambient
  hints. The panel is the visualisation.
- **Replacing the current `temporal` store wholesale across the
  app.** We're switching the canvas history away from zundo,
  but anything else that uses `temporal` (e.g. project / theme
  state if those wire into it) keeps its existing setup. The
  zundo `import` stays.

---

## Architectural decision: replace zundo for canvas state

Zundo gives us undo and redo but does NOT give us:

- Per-entry metadata (labels, action kinds, element ids,
  property keys).
- Per-page stacks — `temporal` is one global pile.
- Jump-to-arbitrary-index — only one step at a time.
- Coalescing logic with custom rules.

We could layer all four on top of zundo in parallel, but that
puts two stacks side by side (zundo's snapshots and our
metadata) and they'll drift the first time someone forgets to
tag a commit. The simpler path is to build a custom history
slice that owns both snapshots and metadata, and remove zundo
from the canvas path entirely.

What we lose by dropping zundo:
- The `equality` short-circuit (we'll add our own equality
  check on commit).
- The `limit` enforcement (we cap at 50 per page ourselves —
  matching the current global limit; revisit if users ask for
  more).

What we keep:
- The exact same external API for Cmd+Z / Cmd+Shift+Z. The
  shortcut handlers in `ProjectShell.tsx` call new
  `historySlice.undo()` / `.redo()` functions that look the
  same to the user.

---

## Data model

### History entry

```ts
// src/renderer/store/historyTypes.ts

/**
 * Discriminated taxonomy of canvas mutations the history panel
 * surfaces. Labels are generated from this kind plus the entry's
 * resolved metadata at display time — see `formatHistoryLabel`
 * below.
 */
export type HistoryActionKind =
  | 'draw-rect'      // "Drew rectangle"
  | 'add-text'       // "Added text"
  | 'delete'         // "Deleted [name]"
  | 'move'           // "Moved [name]"
  | 'resize'         // "Resized [name]"
  | 'patch'          // "Changed [property] — [name]"
  | 'raw-css'        // "Edited styles — [name]"
  | 'rename'         // "Renamed [old] to [new]"
  | 'add-page'       // "Added page [name]"
  | 'delete-page'    // "Deleted page [name]"
  | 'paste'          // "Pasted [name]"
  | 'duplicate'      // "Duplicated [name]"
  | 'external-edit'; // "External edit detected"

export type HistoryEntry = {
  /** Stable id for React keys and direct-jump references. */
  id: string;
  /** Wall-clock timestamp the entry was committed (ms). */
  timestamp: number;
  /** The action's classification. Drives the label template. */
  kind: HistoryActionKind;
  /**
   * Elements involved in the action. Empty for page-scope
   * actions (`add-page`, `delete-page`) and `external-edit`.
   * The first id is used as "[name]" in the label.
   */
  elementIds: ReadonlyArray<string>;
  /**
   * For `patch` kind: which property keys this entry mutated.
   * Used for coalescing (next same-property edit within 500ms
   * folds in) AND for the label ("Changed background"). For
   * `raw-css`, we don't decompose individual properties — the
   * editor commits one bundle.
   */
  propertyKeys?: ReadonlyArray<keyof ScampElement>;
  /**
   * For `rename`: the previous name. The next name is the
   * element's current `name` at display time.
   */
  previousName?: string;
  /**
   * For `add-page` / `delete-page` / `rename` and other actions
   * that touch a page name: the page name string. We store it
   * even though the element model has no page-id concept,
   * because deleted pages and renamed pages need a stable
   * display label.
   */
  pageName?: string;
  /**
   * Full elements map captured AFTER this entry committed.
   * Restoring this entry replaces the live elements map with
   * this snapshot. Yes, this is a full copy — see "Memory
   * bound" below for the tradeoff. Object identity is checked
   * on commit so genuine no-op set()s don't push entries.
   */
  snapshot: Record<string, ScampElement>;
};
```

### Per-page slice

```ts
// src/renderer/store/historySlice.ts

export type PageHistory = {
  /** Ordered list, oldest first, newest last. Capped at 50
   *  per `MAX_HISTORY_ENTRIES`. */
  entries: HistoryEntry[];
  /**
   * Index of the entry the user is currently AT. `entries[cursor]`
   * is the state the canvas is showing. `cursor === -1` means
   * "before the first entry" — only possible at page load when
   * no actions have been recorded yet.
   */
  cursor: number;
};

export type HistorySlice = {
  /** Keyed by `activePage.tsxPath` — survives page switches. */
  perPage: Record<string, PageHistory>;

  /** Push a new entry to the active page's stack, coalescing if
   *  the rules below apply. Trims forward entries (entries after
   *  `cursor`) before appending — branching is not modelled. */
  commitHistory: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;

  /** Jump the active page's cursor to `targetIndex`, restoring
   *  the snapshot at that entry. Used by the panel and by undo/redo. */
  jumpToHistory: (targetIndex: number) => void;

  /** Convenience: cursor − 1. No-op when cursor <= 0. */
  undo: () => void;

  /** Convenience: cursor + 1. No-op at the head. */
  redo: () => void;

  /** Drop the active page's stack entirely (used by "clear
   *  project", "switch project", etc.). */
  clearHistory: () => void;
};
```

### Memory bound

Full elements-map snapshots per entry × 50 entries per page is
the worst case. For a 200-element page with rich style objects,
one snapshot is maybe 200 KB; 50 of them is ~10 MB per page. On
a project with 10 pages all hot, ~100 MB.

For the POC scale (small projects, single-digit pages, hundreds
of elements at most) this is fine — Electron starts with hundreds
of MB of headroom. Defer optimisation:

- **If memory becomes a real issue:** switch from full snapshots
  to JSON-Patch deltas (computed at commit time, applied
  forward/back through the stack). Same metadata, smaller
  footprint, but reconstructing arbitrary states is O(N) instead
  of O(1).
- **For now:** plain snapshots. Easier to reason about, makes
  jump-to-N a single assignment.

### Coalescing rules

When `commitHistory` is called with `kind: 'patch'`, compare to
the previous entry on the active page:

- Same `kind: 'patch'`.
- Same `elementIds` (deep equal, but in practice it's one id).
- Same `propertyKeys` (set equality — `[backgroundColor]` matches
  `[backgroundColor]` regardless of order, doesn't match
  `[backgroundColor, opacity]`).
- `entry.timestamp - prev.timestamp < 500ms`.

If all four match: replace the previous entry's `snapshot` with
the new one (and update its timestamp), don't append. The
cursor stays where it is — the entry it pointed at just got
updated.

Other action kinds never coalesce — moving twice in 500ms is two
entries; drawing two rectangles in 500ms is two entries. This
matches the spec's "Consecutive changes to the same property on
the same element within 500ms are collapsed".

**Exception for `move` and `resize`:** drag operations call
`moveElement`/`resizeElement` on every pointermove tick. We
suppress per-tick commits entirely and commit a single entry on
pointerup. See "Mutation API" below.

### Identity-equality short-circuit

Before any of the above runs, `commitHistory` checks
`snapshot === entries[cursor]?.snapshot` (or content equality if
we're paranoid). True means the set() didn't actually change
anything — e.g. a `patchElement(id, { x: el.x })` no-op. Skip.

---

## Mutation API — explicit commits

The current store's mutation methods (`moveElement`, `patchElement`,
`addElement`, …) call `set(...)` which auto-records via zundo.
After this change, `set(...)` updates state only — it does NOT
push a history entry. Each mutation method is responsible for
calling `commitHistory(...)` separately, at the right moment, with
the right metadata.

This requires editing every mutation site in `canvasSlice.ts`,
but each edit is small and local.

### Drag / resize — transaction-style

The hard cases are `moveElement` and `resizeElement`. They're
called on every pointermove tick. We don't want to commit per
tick — that's the 30-entries-per-drag bug.

Two options:

- **Option A: per-tick commit with coalesce.** Every tick calls
  `commitHistory({ kind: 'move', elementIds: [id], … })`, and the
  500ms coalesce rule plus a new `move` coalesce branch folds them
  into one entry. Simpler to wire, but a 1s drag still touches
  `commitHistory` 30+ times — wasted work, and the timestamp on
  the entry creeps forward through the drag, which is correct but
  feels wrong.
- **Option B (recommended): transactional commits.** Add
  `beginHistoryTransaction()` and `endHistoryTransaction(metadata)`
  to the slice. Between begin and end, mutation methods don't
  commit. The pointer-down handler in `CanvasInteractionLayer.tsx`
  calls `begin()`, and pointer-up calls `end({ kind: 'move',
  elementIds: [id] })` — one entry per drag, no per-tick churn.

Recommend Option B. The store gets:

```ts
type HistorySlice = {
  // ...
  /** Suppress entries until the next `endHistoryTransaction`.
   *  Nested begins are stacked: only the outermost end commits. */
  beginHistoryTransaction: () => void;
  /** Commit a single entry covering everything that happened
   *  since the matching begin. Snapshot is the current elements
   *  map. */
  endHistoryTransaction: (
    entry: Omit<HistoryEntry, 'id' | 'timestamp' | 'snapshot'>
  ) => void;
};
```

Mutation methods called between begin/end still mutate `state.elements`;
they just skip the commit. The end records the post-mutation state
once.

### Mutation site edits

| Method | When to commit |
|---|---|
| `addElement(...)` | Immediately after the `set`. `kind: 'draw-rect'` or `'add-text'` based on element type. |
| `moveElement(...)` | Skip during transaction. Pointer-up commits `kind: 'move'`. |
| `resizeElement(...)` | Skip during transaction. Pointer-up commits `kind: 'resize'`. |
| `patchElement(id, patch)` | Immediately after the `set`. `kind: 'patch'`, `propertyKeys: Object.keys(patch)`. Subject to 500ms coalesce. |
| `deleteElement` / `deleteSelected` | Immediately. `kind: 'delete'`. |
| `duplicateElement` | Immediately. `kind: 'duplicate'`. |
| `pasteElements` | Immediately. `kind: 'paste'`. |
| `renameElement(id, newName)` | Immediately. `kind: 'rename'`, `previousName: oldName`. |
| `commitRawCss(id, css)` | Immediately. `kind: 'raw-css'`. |
| `addPage(name)` | Immediately. `kind: 'add-page'`, `pageName: name`. |
| `deletePage(name)` | Immediately. `kind: 'delete-page'`, `pageName: name`. |
| External edit (syncBridge.ts) | Immediately after the reload. `kind: 'external-edit'`. |

Page rename is interesting — the spec doesn't explicitly call it
out under "history entry labels", so we treat it as `kind: 'patch'`
on the page wrapper element if the element model has one, otherwise
skip the entry. (Today the page-rename action edits the project
config, not an element. Confirm during implementation — see open
question #4.)

---

## Label generation

Labels are pure functions of the entry plus the LIVE elements map
(not a snapshot). That's how retroactive rename works: rename
"rect_a1b2" to "hero-card_a1b2", and every past entry that
references `a1b2` now shows the new name on its label.

```ts
// src/renderer/store/formatHistoryLabel.ts

const elementDisplayName = (
  el: ScampElement | undefined,
  fallback: string
): string => {
  if (!el) return fallback; // element since deleted — show fallback
  if (el.name && el.name.length > 0) return slugifyName(el.name) + '_' + el.id;
  return defaultPrefix(el.type) + '_' + el.id;
};

export const formatHistoryLabel = (
  entry: HistoryEntry,
  elements: Record<string, ScampElement>
): string => {
  const firstName = entry.elementIds[0]
    ? elementDisplayName(elements[entry.elementIds[0]], `[deleted]`)
    : '';

  switch (entry.kind) {
    case 'draw-rect': return 'Drew rectangle';
    case 'add-text':  return 'Added text';
    case 'delete':    return `Deleted ${firstName}`;
    case 'move':      return `Moved ${firstName}`;
    case 'resize':    return `Resized ${firstName}`;
    case 'patch':
      // Map CSS property keys to readable names ("background", not
      // "backgroundColor"). Reuse the FIELD_LABELS map from
      // sections/Section.tsx — promote it to a shared module.
      return `Changed ${formatPropList(entry.propertyKeys ?? [])} — ${firstName}`;
    case 'raw-css':   return `Edited styles — ${firstName}`;
    case 'rename':
      return `Renamed ${entry.previousName ?? '?'} to ${firstName}`;
    case 'add-page':    return `Added page ${entry.pageName ?? '?'}`;
    case 'delete-page': return `Deleted page ${entry.pageName ?? '?'}`;
    case 'paste':       return `Pasted ${firstName}`;
    case 'duplicate':   return `Duplicated ${firstName}`;
    case 'external-edit': return 'External edit detected';
  }
};
```

`FIELD_LABELS` currently lives inside `Section.tsx:275`. Promote
it to `src/renderer/lib/fieldLabels.ts` so both the section
override-indicator and the history label generator can share it.

---

## Page-switch and external-edit behaviour

### Page switch

The current code calls `temporal.clear()` on page switch. With
per-page history this becomes:

1. On page switch, the active page changes; the
   `useCanvasStore.activePage` field updates.
2. Selectors that read history (`useHistoryEntries()`,
   `useHistoryCursor()`) auto-read the slice keyed by the new
   active page's `tsxPath`.
3. Pages with no history yet get a default `{ entries: [],
   cursor: -1 }`.
4. The previous page's history stays put in `perPage[oldPath]`
   and is restored when the user navigates back.

No more `temporal.clear()`. The page-switch handler just toggles
which page's history is visible.

### External edit

Today `syncBridge.ts` calls `temporal.getState().clear()` after
an external reload. The story spec changes this to:

1. After the external reload, push a single
   `kind: 'external-edit'` entry with the new elements map as
   the snapshot.
2. Trim any forward entries beyond the current cursor first
   (same as any other new commit) — external edits behave like a
   user action from the history-panel's perspective.

The cursor advances to the new entry. Cmd+Z immediately after
an external edit takes you BACK to the state from before the
external edit — which is correct, but worth noting because
today's behaviour is "external edits clear undo entirely" so this
is new.

---

## UI — `HistoryPanel.tsx` as a left-sidebar tab

The left `<aside>` in `ProjectShell.tsx` (lines 756–860) currently
stacks two sections inside one column:

- `Pages` (top): the project's pages with add / rename /
  duplicate affordances.
- `Layers` (bottom): the `ElementTree` for the active page.

We restructure it as a **two-tab sidebar**:

- **"Pages & Layers" tab** (default) — the existing Pages +
  Layers sections, unchanged in content. Just lifted into a
  tab-content container.
- **"History" tab** — the new history list for the active page.

This keeps the right rail's properties panel untouched and gives
History first-class real estate without crowding the canvas.

### Mounting and position

```
┌─────────────────────────┬─────────────────────────────┬──────────────────┐
│ ┌─────────┬──────────┐  │                             │                  │
│ │ Pages   │ History  │  │                             │                  │
│ │ &       │          │  │           Canvas            │ PropertiesPanel  │
│ │ Layers  │          │  │                             │ (right)          │
│ │ ▔▔▔▔▔   │          │  │                             │                  │
│ ├─────────┴──────────┤  │                             │                  │
│ │                    │  │                             │                  │
│ │   tab content      │  │                             │                  │
│ │                    │  │                             │                  │
│ │                    │  │                             │                  │
│ │                    │  │                             │                  │
│ └────────────────────┘  │                             │                  │
└─────────────────────────┴─────────────────────────────┴──────────────────┘
```

The aside keeps its current width and column layout; only the
inner content changes. The tab strip lives directly under the
aside's existing chrome, with the active tab's content filling
the rest of the column.

### Tab strip

Two buttons in a horizontal row at the top of the aside,
underline-style active state (matches the existing
`PanelModeToggle` in the properties panel). State lives in the
canvas store as `leftSidebarTab: 'layers' | 'history'` so the
choice is per-session global (not per-page) and survives view
changes within the session. Default `'layers'` so existing users
see no change on first open.

Active-tab styling: full-strength text + 2px underline accent in
`--accent`. Inactive: secondary text, no underline. Hover: text
goes full-strength, underline appears at half opacity.

### Switching to the History tab

Three entry points:

1. **Click the "History" tab.** Standard.
2. **Cmd+Shift+H.** Toggles between the two tabs (Layers ↔
   History) rather than show/hide-ing a separate panel. If the
   aside is somehow collapsed by future work, the shortcut also
   ensures it's expanded before switching.
3. **Toolbar "History" button.** Same as the keyboard shortcut.
   Removed if the user finds the tab strip discoverable enough on
   its own — open question #3.

### "Pages & Layers" tab content

Lift the existing Pages section + Layers section into a single
component `PagesLayersTab.tsx`. No behaviour change — same Pages
list, same `ElementTree`. The lift is mostly mechanical (the
existing JSX moves out of `ProjectShell.tsx` into the new file)
and gives us a clean component boundary instead of inline JSX.

### History tab content

Renders `HistoryPanel.tsx` which reads the active page's
`PageHistory` from the slice. Tab-aware: when this tab is hidden,
`HistoryPanel` doesn't render, so its 30s relative-time interval
isn't burning a timer in the background.

### Panel layout

```
┌────────────────────────────┐
│ ● Changed background       │
│   hero-card_a1b2  just now │
│   Changed gap              │
│   rect_a1b2     1 min ago  │
│   Added element            │
│   rect_c3d4     1 min ago  │
│   …                        │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│   Changed border-radius    │
│   rect_a1b2     5 min ago  │
│   Changed height           │
│   rect_a1b2     6 min ago  │
└────────────────────────────┘
```

The list fills the tab's content area — no extra header chrome
since the tab strip already labels "History". There's no close
"×" inside the panel either; closing means clicking the
"Pages & Layers" tab.

- Most-recent entry at the top. The list scrolls.
- The **current cursor entry** is highlighted with a left-border
  accent and a leading bullet (●).
- Entries *above* the cursor (more recent than cursor in the
  stored array, but already-applied) — solid text.
- Entries *below* the cursor — greyed out (these are the
  redoable forward entries).
- Divider line between past and future for visual clarity.
- Each entry shows: kind-derived label (line 1), element class
  name (line 2 left), relative timestamp (line 2 right). The
  absolute timestamp is on the title hover tooltip.

### Click behaviour

- Click an entry above the current cursor → `jumpToHistory(idx)`
  where idx is in the past direction. The canvas updates
  immediately, the properties panel updates, the file write
  flows through the normal save pipeline (`syncBridge.ts`'s
  debounce already covers this).
- Click an entry below the cursor → same call, jumps forward.
- Click the current entry → no-op (already there).

### "Drag is in flight" suppression

The story spec: "The panel is display-only during a canvas drag
or resize operation — history entries are only written on
mouseup". Two parts:

1. Entries don't appear in the panel during the drag — covered
   for free by the transaction-style commit (the entry isn't
   created until pointerup).
2. The panel itself should be unclickable during a drag — we
   gate click handlers on a `isDragging` selector from the
   canvas store. Clicks are dropped silently while a drag is
   in flight.

### Relative timestamps

A small `formatRelativeTime(ts: number, now: number)` helper:

- < 30s → "just now"
- < 60s → "30 sec ago"
- < 60 min → "N min ago"
- < 24h → "N hr ago"
- ≥ 24h (rare for an in-memory session, but possible if the app
  stays open overnight) → absolute clock time

The panel re-renders every 30s on a `setInterval` so timestamps
update. (No global clock; just the panel's own tick.)

### Keyboard shortcut

`Cmd+Shift+H` toggles the active left-sidebar tab between
`'layers'` and `'history'`. Added to the existing
keyboard-shortcut block in `ProjectShell.tsx`. Suppressed when an
input is focused, same convention the existing Cmd+Z handler
uses.

---

## Tests

### Unit tests

New file: `test/historySlice.test.ts`. Vitest, no DOM, no
Electron — pure store logic.

```ts
describe('historySlice — basic stack', () => {
  it('commits a draw-rect entry and advances the cursor', () => { /* ... */ });
  it('undo moves cursor back one entry', () => { /* ... */ });
  it('redo moves cursor forward one entry', () => { /* ... */ });
  it('a new commit after undo discards the forward entries', () => { /* ... */ });
  it('caps the stack at 50, dropping the oldest entry when full', () => { /* ... */ });
});

describe('historySlice — coalescing', () => {
  it('coalesces two patch entries on the same element/property within 500ms', () => { /* ... */ });
  it('does NOT coalesce when property keys differ', () => { /* ... */ });
  it('does NOT coalesce when element ids differ', () => { /* ... */ });
  it('does NOT coalesce across kinds (move + patch)', () => { /* ... */ });
  it('does NOT coalesce when the gap is > 500ms', () => { /* ... */ });
});

describe('historySlice — transactions', () => {
  it('skips commits during a transaction and records one entry on end', () => { /* ... */ });
  it('handles nested begins (only outermost end commits)', () => { /* ... */ });
});

describe('historySlice — per-page isolation', () => {
  it('keeps separate stacks per page id', () => { /* ... */ });
  it('switching pages restores the previous page stack on switch-back', () => { /* ... */ });
});

describe('historySlice — external edits', () => {
  it('records an external edit as a single entry that trims forward history', () => { /* ... */ });
});
```

### Label-generation tests

New file: `test/formatHistoryLabel.test.ts`.

```ts
describe('formatHistoryLabel', () => {
  it('renders "Drew rectangle" for draw-rect', () => { /* ... */ });
  it('renders "Changed background — hero-card_a1b2" for a patch entry', () => { /* ... */ });
  it('uses the CURRENT element name even on old entries (retroactive rename)', () => {
    // Entry references id 'a1b2', stored when name was 'old'. After the
    // user renames the element to 'hero-card', the label reads
    // 'Changed background — hero-card_a1b2'.
  });
  it('falls back to "[deleted]" when an entry references a deleted element', () => { /* ... */ });
  it('renders "Renamed [old] to [new]"', () => { /* ... */ });
});
```

### Integration tests

Extend `test/integration/externalEdit.integration.test.ts`:

```ts
it('external edit pushes a single history entry, not many', () => { /* ... */ });
it('external edit clears forward history beyond the current cursor', () => { /* ... */ });
```

### Drag-no-spam test

New: assert that a sequence of `beginHistoryTransaction()` /
`moveElement(...) × 30` / `endHistoryTransaction(...)` produces
exactly one history entry.

---

## Implementation order

Each step ships with passing tests before moving on. Same
bottom-up flow used for the box-shadow / filter / blend-mode
stories.

1. **History slice scaffold.** `historyTypes.ts`,
   `historySlice.ts` with the data model, `commitHistory`,
   `jumpToHistory`, `undo`, `redo`, `clearHistory`. No
   integration with the canvas slice yet — just the slice and
   its unit tests. Stack works in isolation.

2. **Transactions.** Add `beginHistoryTransaction` /
   `endHistoryTransaction` to the slice. Nested begin handling.
   Tests pass.

3. **Coalescing.** Add the 500ms same-property merge logic.
   Identity-equality short-circuit. Tests pass.

4. **Label generator.** `formatHistoryLabel.ts`. Promote
   `FIELD_LABELS` from `Section.tsx:275` to
   `src/renderer/lib/fieldLabels.ts`. Both files now import
   from the shared module. Tests pass.

5. **Wire into canvasSlice mutations.** Replace zundo with the
   new slice. Edit every mutation method to call
   `commitHistory(...)` with the right metadata. Update the
   keyboard shortcut handlers in `ProjectShell.tsx`. Update
   `syncBridge.ts` to push an `external-edit` entry instead of
   clearing. Update page-switch handlers to NOT clear the slice
   (each page's history stays in `perPage`). Remove
   `temporal(...)` wrapping from `useCanvasStore`.

   At this step, Cmd+Z / Cmd+Shift+Z still work for the user;
   they just go through the new slice now. No UI change yet.

6. **Transaction wiring at drag handlers.**
   `CanvasInteractionLayer.tsx`'s pointer-down calls
   `beginHistoryTransaction`. Pointer-up calls
   `endHistoryTransaction({ kind: 'move' | 'resize',
   elementIds: [...] })`. The 30-entries-per-drag bug is gone.

7. **Sidebar tab refactor.** Lift the existing inline
   Pages + Layers JSX from `ProjectShell.tsx` (lines 756–860)
   into a `PagesLayersTab.tsx` component — pure move, no
   behaviour change. Add a `leftSidebarTab` field to the canvas
   store (default `'layers'`). Add a small `SidebarTabStrip`
   component (two buttons, underline-active style) at the top
   of the `<aside>`. Wire the strip to switch between
   `PagesLayersTab` and a placeholder `HistoryTab` for now.
   Existing layers-panel tests (`data-testid="layers-panel"`)
   keep passing because the tab content still renders that
   element when the layers tab is active.

8. **History panel UI.** `HistoryPanel.tsx` +
   `HistoryPanel.module.css`. Mount it as the `'history'`
   tab's content (replacing the placeholder).
   `useHistoryEntries()` / `useHistoryCursor()` /
   `useLeftSidebarTab()` selectors. Add the Cmd+Shift+H
   keyboard handler in `ProjectShell.tsx`'s existing
   shortcut block.

9. **Polish.** Relative-time interval refresh. Drag-in-flight
   click suppression. Tooltip with absolute time on hover.
   Empty state copy: "No changes made in this session" (no
   synthetic "Loaded page" entry — a fresh page just shows the
   empty-state message). Tab strip styling matches the existing
   `PanelModeToggle` for visual consistency.

10. **Docs.** Update `agent.md` to note that external edits now
    appear in history rather than wiping it. Update any
    onboarding text that references the 50-step limit (none
    that I can see at first glance, but worth grepping).

---

## Risks and edge cases

- **Memory drift on long sessions.** Full snapshots × 50
  entries × N pages can balloon if elements are heavyweight.
  Mitigation: monitor in practice; if it bites, switch to
  JSON-Patch deltas (the metadata stays the same; only the
  storage shape changes).
- **Deleted-element label.** When the user undoes past a
  `delete` entry, the element is back — labels resolve fine.
  When they redo past it, the element is gone again, and any
  later entry referencing that id renders `[deleted]`. That's
  the correct read: the user is looking at a "what happened
  next" entry for an element they've since removed.
- **Page rename mid-history.** If the user renames a page,
  `activePage.tsxPath` changes. The page's history is keyed by
  the OLD path → the entries are stranded under
  `perPage[oldPath]`. Mitigation: on page rename, move the
  entry under the new key, drop the old key. Same hook the
  filesystem watcher uses.
- **External edits during a drag.** Today, a chokidar event
  arriving mid-drag is rare but possible. After this change,
  the transaction is still open when the external reload
  arrives. **Behaviour: defer the external edit until the drag
  finishes.** While `historySlice.transactionDepth > 0`,
  `syncBridge.ts` queues incoming external-edit reloads instead
  of applying them. On `endHistoryTransaction(...)` (i.e.
  pointerup), the transaction commits its `move`/`resize`
  entry as normal, and immediately afterwards the queued
  external reload runs, replacing the elements map and
  committing a separate `kind: 'external-edit'` entry. The
  user gets a two-entry sequence (`Moved X`, then
  `External edit detected`) and a quick visual snap if the
  agent's edit conflicts with theirs. The drag gesture is
  never interrupted. The queue holds at most one pending
  reload — multiple rapid external fires coalesce by re-reading
  the file once the drag ends.
- **Identity-equality false positives.** Our short-circuit
  uses `===` on `snapshot` against the previous entry's
  snapshot. If a mutation returns the SAME elements map
  reference (e.g. a `set` that early-returns `state`), we
  correctly skip the commit. The risk is the opposite — a
  mutation that produces a new map identical in content to
  the previous one wouldn't short-circuit. That's a wasted
  history slot but not a correctness bug. Optionally add a
  shallow content comparison as a follow-up if it shows up
  in practice.
- **Cursor-at-end discard rule.** When a user undoes back to
  cursor 5 (with entries 6–10 sitting forward), and then makes
  a new edit, entries 6–10 are dropped. Standard linear
  history. Test: assert the trim happens; assert the panel
  no longer shows the greyed-out entries.
- **Test fixtures.** Several tests use Zundo directly via
  `useCanvasStore.temporal.getState()`. Search & replace those
  with the new slice API. Likely small.

---

## Open questions for review

1. **Replace zundo entirely vs layer alongside.** Recommendation
   is to replace it for canvas state — the story's needs
   (metadata, per-page, jump-to-N, coalesce) significantly
   exceed zundo's API and parallel systems will drift. Confirm
   you're OK with dropping the dependency from this slice. Agreed.

2. **Memory model.** Recommendation is full snapshots per entry
   for v1 (simple, fast restore), revisit if memory becomes a
   real issue. Alternative is JSON-Patch deltas from day one —
   smaller but O(N) to restore. Confirm v1 picks snapshots. Agreed. 

3. **Toolbar "History" button.** With the left-sidebar tab as
   the primary entry point and Cmd+Shift+H as the keyboard
   shortcut, do we also need a toolbar button? My recommendation
   is to skip it — the tab strip is discoverable on its own and
   the toolbar is already busy. Confirm. skip it

4. **Page-rename and project-config entries.** The story spec's
   "Renamed [old] to [new]" label is described for elements.
   Page renames touch the project config rather than an element.
   Should they appear in history? My take: yes, as a
   `kind: 'rename'` entry with `pageName` set, so the user sees
   the action they took. Confirm. agreed.

5. **External-edit-during-drag handling.** Resolved: **defer**.
   The external reload is queued while a transaction is open
   and applied immediately after pointerup, producing two
   sequential entries (`Moved X` → `External edit detected`).
   The drag gesture is never interrupted; the user keeps their
   intent, and the agent's edit lands a beat later.

6. **Stack limit.** Resolved: **start with 50** (matches the
   current global limit). Easy to bump later by changing a
   single `MAX_HISTORY_ENTRIES` constant if users ask for more.

7. **Initial entry on page load.** When the user opens a page,
   the history is empty (`cursor: -1`). Their first edit pushes
   entry 0. Should there be a synthetic "Loaded page" entry at
   index 0 so they can "undo" back to the as-loaded state? My
   take: no — the user didn't take that action and clicking it
   wouldn't undo anything meaningful. Confirm. no loading a page shouldnt show an entry. if they havent changed anything on the canvas it should just say "no changes made in this session" or something like that.
