---
title: Undo/redo history coverage
related:
  - src/renderer/store/historyTypes.ts
  - src/renderer/store/historySlice.ts
  - src/renderer/store/canvasSlice.ts
  - src/renderer/src/components/ProjectShell.tsx
---

# Undo/redo history coverage

Which mutations push onto the undo stack, which deliberately don't, and
how the stack itself works. Build/refresh the push list by grepping
`commitHistory` / `commitElementsToHistory` callers in
`src/renderer/store/canvasSlice.ts` and `commitHistory` in
`src/renderer/src/components/ProjectShell.tsx`.

Primary files: `src/renderer/store/historyTypes.ts` (kinds),
`src/renderer/store/historySlice.ts` (mechanics),
`src/renderer/store/canvasSlice.ts` (push sites).

## `HistoryActionKind`

`draw-rect`, `add-text`, `add-image`, `add-input`,
`add-component-instance`, `convert-to-component`, `detach-instance`,
`delete`, `move`, `resize`, `patch` (generic style/layout catch-all),
`raw-css`, `rename` (name-only patch, special-cased label),
`rename-page`, `add-page`, `delete-page`, `paste`, `duplicate`, `group`,
`ungroup`, `wrap-link`, `reorder`, `toggle-group`, `external-edit`,
`load` (initial bucket seed on page/component open).

Note `add-page` / `delete-page` are **defined but not currently
committed** — page add/delete go through IPC and push no in-band entry
(see below).

## Operations that push (kind → where)

Element-level, all in `canvasSlice.ts` via `commitElementsToHistory`:

| Operation | kind |
|---|---|
| draw rectangle / add text / image / input | `draw-rect` / `add-text` / `add-image` / `add-input` |
| insert component instance | `add-component-instance` |
| convert subtree to component | `convert-to-component` |
| detach instance | `detach-instance` |
| rename component references | `patch` (`propertyKeys: ['componentName']`) |
| delete / duplicate | `delete` / `duplicate` |
| paste | `paste` |
| group / ungroup | `group` / `ungroup` |
| wrap in link | `wrap-link` |
| reorder | `reorder` |
| set/clear prop override | `patch` (`['propOverrides']`) |
| set element text / toggle-prop / rename-prop on text | `patch` (`['text']` / `['prop']`) |
| move / resize (drag) | `move` / `resize` — see transactions |
| patch element (rename-only) | `rename` (carries `previousName`) |
| patch element (other) / reset fields at breakpoint or state | `patch` |
| set / remove animation | `patch` (`['animation']`) |
| toggle property group | `toggle-group` |

Page/document-level:
- **rename page** → `rename-page`, pushed from `ProjectShell.handleRenamePage`;
  the history bucket is also **rekeyed** (`rekeyPage`) from the old
  `tsxPath` to the new one so the stack survives the file move.
- **external file edit** → `external-edit`, enqueued from the sync bridge
  (`enqueueExternalEdit`), committed after any open transaction ends.

## Operations that deliberately don't push (and why)

- **Selection / tool / editing-mode** (`selectElement`,
  `toggleSelectElement`, `setTool`, `setEditingElement`,
  `setEditingInstanceProp`) — transient UI state. Only the *committed*
  result (e.g. final text via `setElementText`, final override via
  `setPropOverride`) pushes.
- **Copy** — clipboard only; `paste` is the design decision, not copy.
- **Load page / component / reloadElements** — `loadPage`/`loadComponent`
  seed a `load` entry via `commitInitialIfEmpty` (not a user action);
  external reloads push `external-edit` from the bridge instead.
- **All UI/panel state** — `setBottomPanel`, `setPanelMode`,
  `setLeftSidebarTab`, zoom (`zoomIn/out`, `resetZoom`, `setZoom`),
  `playAnimation` (preview), export settings.
- **Editing context** — `setActiveBreakpoint`, `setActiveState`: choosing
  *which* breakpoint/state you're editing isn't itself a mutation.
- **Project-level** — `setBreakpoints`, `setProjectFormat`,
  `setProjectPath`, `setPageNames`, `setComponentTrees`,
  `setCanvasMinHeight`, navigation requests, `setThemeTokens`. These are
  managed outside the per-page element history.
- **Add / delete page** — done through `window.scamp.createPage` /
  `deletePage` IPC; no in-band history entry (the `add-page` /
  `delete-page` kinds are reserved but unused). Undo does not resurrect a
  deleted page.

## Phase 5.5 audit conclusion

Every **per-page element-map mutation** in `canvasSlice.ts` pushes — all
24 element mutators (draw/add, delete/duplicate, group/ungroup,
move/resize, patch/patchCustomProperties, set/clearPropOverride,
set/removeAnimation, reset-at-breakpoint/state, togglePropertyGroup, …)
call `commitElementsToHistory` (directly or by delegating to
`patchElement`). So coverage **within the per-page element-history model
is complete**, and the plan's acceptance — undo an instance
prop-override after navigating away and back — holds (locked in by
`test/historyPropOverride.test.ts`).

The named "gaps" are **not** missing wiring — they're state that lives
*outside* the per-page element snapshot, so there's no `elements` map to
commit:

- **Theme-token edits** (`setThemeTokens`) — project-wide, not per page.
  A per-page snapshot of project-wide tokens has muddy cross-page
  semantics (undo on page B could revert a token changed while editing
  page A). Proper undo needs a **separate project-level history**, which
  is a feature, not a cleanup — deliberately out of 5.5 scope.
- **Custom CSS / `@media`-block edits** (CssPanel) — go straight to disk
  via `savePatch` (file patch), not through an `elements` mutation; the
  canvas updates on the round-trip reload. Page-level
  (`pageCustomMediaBlocks`) is document-level state, same boundary.
- **Component definition rename / delete** — component-management ops,
  managed outside per-page element history exactly like add/delete page
  (the `raw-css` / `add-page` / `delete-page` kinds stay reserved-unused).

In short: nothing was added to the per-page stack because nothing was
missing from it; the real gaps want a project-level history feature.

## Mechanics (`historySlice.ts`)

- **Per-page buckets**, keyed by the target's `tsxPath`. Each bucket is
  `{ entries: HistoryEntry[], cursor }`; `entries` is oldest-first,
  **capped at 50**. `cursor` points at the current state; `cursor === -1`
  means no entries yet.
- **Entries are full snapshots** — each `HistoryEntry.snapshot` is a copy
  of the entire elements map after the action, plus metadata (`kind`,
  `elementIds`, `propertyKeys`, `previousName`, …). Undo/redo restore by
  swapping the snapshot, not by replaying deltas.
- **Restore is delegated:** the history slice never mutates canvas state
  directly; the canvas store registers a callback via
  `setRestoreSnapshot`.
- **Cursor model:** committing a new entry trims everything past the
  cursor, then appends. `undo` = `jumpToHistory(cursor - 1)`, `redo` =
  `jumpToHistory(cursor + 1)`, both no-op at the ends.
- **Coalescing:** same-element, same-`propertyKeys` `patch` entries within
  `COALESCE_WINDOW_MS = 500` fold into the previous entry (replaces its
  snapshot, cursor unchanged) so a slider drag is one undo step. An
  identity short-circuit skips the commit entirely if `set()` produced
  the same snapshot reference.
- **Transactions:** `beginHistoryTransaction` / `endHistoryTransaction`
  suppress per-tick commits and emit a single net entry — used by move
  drag, resize drag, and color-picker drag (the per-tick `move`/`resize`
  calls in `canvasSlice` are no-ops until the outermost transaction ends
  in `CanvasInteractionLayer`).
- **External edits during a drag** are queued (`pendingExternalEdit`,
  latest-wins) and drained when the transaction ends, so a drag stays
  atomic.
- **`commitInitialIfEmpty`** seeds a `load` entry at cursor 0 on open
  (idempotent — revisiting a page keeps its existing stack), so the first
  `Cmd+Z` returns to the loaded state rather than no-opping.
