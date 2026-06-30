# Rename Pages — Plan

**Status:** Proposed
**Date:** 2026-04-15
**Backlog item:** #11

## Goal

Let users rename a page from the Pages sidebar via the existing
right-click context menu. The operation renames both page files on
disk, rewrites the CSS-module import and the component name inside
the TSX, and keeps the canvas pointed at the renamed page without a
flicker or a disk/state mismatch.

---

## Current state

The Add / Duplicate / Delete flows (backlog #9) already landed and
provide almost every primitive this story needs:

- `PageContextMenu` renders arbitrary menu items keyed by `label` —
  just add a `Rename` entry.
- `PageNameInput` already handles inline naming with validation,
  seeded values, range selection, busy + error surfaces, blur-cancels.
- `pageEdit` state in `ProjectShell` is already modelled as a sum type
  (`'new' | { duplicate: string } | null`) so extending it with a
  `{ rename: string }` variant is straightforward.
- `componentNameFromPage` and the `rewriteDuplicateTsx` regex for the
  import line + default-export function live in `src/main/ipc/page.ts`
  and can be reused or extracted.
- `validatePageName` in `src/shared/pageName.ts` already rejects
  collisions, so rename can reuse it — the renamer's own old name just
  needs to be excluded from `existingNames` so "rename home to home"
  can be caught explicitly as a no-op rather than a collision.

Gaps to close:

- **No `page:rename` IPC channel.** Rename needs its own handler
  (not `file:patch`, not the generic file-write path) so the two-file
  atomic rewrite + delete-old is explicit in the codebase.
- **No UI path.** `PageContextMenu` doesn't expose rename; `pageEdit`
  can't represent it.
- **Sync-bridge interaction.** If the renamed page is the currently
  active one, the `activePage` pointer must flip to the new paths
  without the debounced writer first flushing pending edits to the
  now-deleted old paths.
- **Watcher noise.** chokidar will fire for four paths
  (two creates, two unlinks). None should trigger a canvas reload
  or a write-back.

---

## Data flow

### New IPC: `page:rename`

```ts
type PageRenameArgs = {
  projectPath: string;
  oldPageName: string;
  newPageName: string;
};
// Returns the new PageFile so the renderer can splice it into
// `project.pages` without re-reading the project from disk.
```

Handler steps (in this exact order — see the Risks section):

1. Validate `newPageName` with the existing `PAGE_NAME_RE`
   (alphanumeric + hyphens). Reject if it equals `oldPageName`.
2. Ensure `[new].tsx` and `[new].module.css` do not already exist —
   reject with `A page named "<new>" already exists.` if either does.
3. Ensure `[old].tsx` and `[old].module.css` both exist — reject
   with `Source page "<old>" is missing.` if either doesn't.
4. Read the old TSX into memory.
5. Rewrite the TSX:
   - Import line: `import styles from './<old>.module.css'` →
     `./<new>.module.css`. Use the same regex shape as the duplicate
     handler. If the match fails, reject with a clear error —
     unlike duplicate, we cannot silently proceed because the written
     file would still reference the deleted CSS module and the page
     would break at runtime.
   - Default-export component name:
     `export default function <OldPascal>(` →
     `export default function <NewPascal>(`. Same regex as duplicate.
     If the user has manually edited the signature so the regex
     doesn't match, reject with a clear error (`Couldn't find the
     default-export function in <old>.tsx — rename aborted.`) per
     the backlog note.
6. Mark the four target paths as suppressed via
   `suppressNextChange` so the watcher doesn't echo our own writes
   back to the renderer.
7. Write `[new].tsx` with the rewritten contents.
8. Read the old CSS and write it verbatim to `[new].module.css`.
   (We copy-then-delete instead of `fs.rename` so a partial failure
   leaves the old page intact rather than half-renamed.)
9. Delete `[old].tsx` and `[old].module.css`.
10. Return a `PageFile` describing the new page.

If any step between 4 and 9 throws, attempt a best-effort cleanup of
any new files that were written (so the project isn't left with
duplicates). If cleanup itself fails, log and surface the original
error — the user can remove the stray file manually, as documented
in the backlog's "write-new-then-delete-old" guarantee.

### Shared helpers

Extract the TSX rewrite logic out of `handleDuplicate` so both
handlers use the same regex definitions:

```ts
// src/main/ipc/pageTsxRewrite.ts
export const rewriteImport = (tsx: string, oldName: string, newName: string): string | null;
export const rewriteComponentName = (tsx: string, newComponentName: string): string | null;
```

Each returns `null` on no-match. The duplicate handler keeps its
current "leave the file unchanged on no-match" policy; the rename
handler treats `null` as a hard error.

### Project state refresh

`ProjectShell` already owns `onProjectChange` from story #9. After a
successful rename it:

1. Builds the new pages array by replacing the old `PageFile` with
   the returned new one, preserving list order.
2. Calls `onProjectChange({ ...project, pages: nextPages })`.
3. If the renamed page was the active page, calls
   `setActivePageName(newPage.name)`.

**Before** the IPC call, when the renamed page is the active page,
the shell must force-flush any pending debounced write to the old
files. The cleanest way is to expose a `flushPendingWrite()` from the
sync bridge (a ref passed down, or a module-level `window.__scamp`
hook) and invoke it before dispatching the rename IPC. Without this,
the 200ms write timer could fire against the old paths mid-rename
and recreate a file we just deleted.

Implementation sketch: `initSyncBridge` already has a
`flushDebouncedWrite` closure. Expose it via a module-scoped `let
pendingFlush: (() => void) | null` that `initSyncBridge` assigns on
setup and clears on teardown, plus a `flushPendingPageWrite()`
wrapper that calls it when non-null. The sync bridge is
instantiated once per renderer so a module-scoped handle is fine.

### Watcher suppression

Even with `suppressNextChange` called inside the rename handler, the
renderer may still receive a `file:changed` event for the **new**
paths once chokidar sees them appear. Two guards already in place:

- The sync bridge's `file:changed` handler only reacts when
  `payload.path === activePage.tsxPath || activePage.cssPath`.
  After the rename those equal the **new** paths, so the event
  matches — but the parsed tree will round-trip to the same code as
  the current canvas state, so the existing "skip reload when
  nothing canvas-mappable changed" fast path no-ops the reload.
- Events for the **old** paths (the unlinks) deliver `tsxContent` or
  `cssContent` as `null`, and the bridge already early-returns on
  `null` halves.

So no new bridge logic is required beyond the suppression calls.

---

## UI

### Context menu

Add a `Rename` item to `PageContextMenu` between `Duplicate` and
`Delete`. Plain (non-destructive) styling. Never disabled — a
project always has at least one page, and renaming the only page
is valid.

### Inline rename input

Reuse `PageNameInput` with a new variant of `pageEdit`:

```ts
type PageEdit = 'new' | { duplicate: string } | { rename: string } | null;
```

When `pageEdit = { rename: 'home' }`, the `project.pages.map` render
swaps the `home` row for a `PageNameInput` seeded with `'home'`,
with the full value selected (not a partial range — the user is
replacing, not editing, the old name). `existingNames` excludes the
page being renamed so `rename home → home` is caught as the
explicit no-op error ("New name is the same as the old one") rather
than a collision error.

Confirm calls a new `handleRenamePage(oldName, newName)` which:

1. Sets `pageEditBusy = true`.
2. Flushes any pending debounced write via the sync-bridge hook.
3. Calls `window.scamp.renamePage({ ... })`.
4. On success: splices the returned `PageFile` into `project.pages`
   in place, calls `onProjectChange`, and — if the renamed page was
   active — calls `setActivePageName(newPage.name)` so the load
   effect re-parses the new files.
5. Clears `pageEdit` / busy / error state via `resetPageEdit`.
6. On failure: surfaces the error under the input and leaves it
   open for retry, matching Add and Duplicate.

Escape / blur cancels the rename without side effects. The active
page does NOT change until the IPC succeeds.

### Undo stack

Per the backlog's open question: rename is a file-level operation
outside the canvas history. Treat it as a boundary — on successful
rename, call `useCanvasStore.temporal.getState().clear()` just like
the load-page effect already does on page switch. This avoids undo
attempting to restore a canvas state whose `activePage` pointed at
files that no longer exist.

---

## Implementation phases

### Phase 1 — Backend

1. Add `PageRenameArgs` to `src/shared/types.ts`.
2. Add `IPC.PageRename` to `src/shared/ipcChannels.ts`.
3. Extract the import / component-name rewrite helpers from
   `src/main/ipc/page.ts` into `src/main/ipc/pageTsxRewrite.ts`
   (or keep colocated as non-exported helpers and let the rename
   handler live in the same file — either is fine; prefer
   colocation since the file is still small).
4. Add `handleRename` with the step sequence above.
5. Register `IPC.PageRename`.
6. Expose `renamePage` in `src/preload/index.ts`.

**Acceptance:** from devtools, `window.scamp.renamePage` renames a
page's two files, rewrites the import and component name, returns
the new `PageFile`, and rejects on every error case (regex no-match,
new name taken, old name missing, new === old).

### Phase 2 — Sync-bridge flush hook

1. In `syncBridge.ts`, add a module-scoped `pendingFlush` handle
   populated in `initSyncBridge`.
2. Export `flushPendingPageWrite()` for callers outside the bridge
   to invoke before operations that change the active page's
   on-disk identity.

**Acceptance:** dirtying the canvas, then calling
`flushPendingPageWrite()` from devtools within the debounce window,
writes the pending edit synchronously.

### Phase 3 — UI wiring

1. Extend `pageEdit` with `{ rename: string }`.
2. Add a `Rename` item to `buildMenuItems` in `ProjectShell`.
3. Render the inline `PageNameInput` in place of the target row
   when `pageEdit` is a rename variant. Seed with the current name,
   full-select on mount, exclude the current name from
   `existingNames`.
4. Implement `handleRenamePage`:
   - flush pending write,
   - call IPC,
   - splice `project.pages`,
   - update `activePageName` if it was the renamed page,
   - clear undo history,
   - reset edit state / surface errors.

**Acceptance:** right-click `home` → Rename → type `landing` →
Enter renames the files on disk, the sidebar shows `landing`, the
canvas reloads against the new paths, the code panel reflects the
new import line and component name, and undo history is cleared.
Right-click Rename on the active page, type the same name back, and
the input shows an inline error.

---

## Files changed

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `PageRenameArgs` |
| `src/shared/ipcChannels.ts` | Add `PageRename` |
| `src/main/ipc/page.ts` | Add `handleRename`; optionally factor out `rewriteImport` / `rewriteComponentName` helpers |
| `src/preload/index.ts` | Expose `renamePage` |
| `src/renderer/src/syncBridge.ts` | Expose `flushPendingPageWrite` |
| `src/renderer/src/components/ProjectShell.tsx` | Rename menu item, new `pageEdit` variant, `handleRenamePage` |

No new components or CSS modules — all reuse existing
`PageContextMenu` and `PageNameInput`.

---

## Testing

Unit tests (`test/`):

- `pageTsxRewrite.test.ts` — covers both helpers against the
  `defaultPageTsx` template, edge cases (already-renamed file,
  missing import, manually edited component signature), and
  verifies they return `null` on no-match rather than mangling the
  file.
- Extend `pageName.test.ts` (if present; otherwise add alongside
  the existing `validatePageName` logic) with a case that excludes
  the current name from `existingNames` to cover the rename flow's
  collision check.

Integration test (`test/integration/`):

- `pageRename.integration.test.ts` — runs the rename handler
  against a real temp project directory. Asserts:
  - new files exist with rewritten TSX,
  - old files are gone,
  - CSS contents are byte-identical to the source,
  - rejecting on collision leaves both old files untouched,
  - rejecting on missing import in TSX leaves old files untouched
    and no new files on disk.

---

## Out of scope

- Cross-page references. There are none today; if routing or links
  between pages land later, rename will need to sweep consumers.
  Flagged in the backlog.
- Undo/redo for renames themselves. The operation clears the undo
  stack for the page; the rename itself is only reversible by the
  user renaming back.
- Bulk rename or renaming multiple pages at once.
- Conflict recovery UX. If a rename crashes mid-flight and leaves
  duplicate files on disk, the user resolves it manually on next
  project open. We don't build a reconciliation dialog.

---

## Risks

- **Write-new-then-delete-old ordering.** If the process dies
  between the new-CSS write (step 8) and the delete-old (step 9),
  the project has four files: old and new pages side by side. This
  is the intended failure mode per the backlog — duplicate files
  are safer than missing files. Document this expectation in the
  handler's comment block.

- **Pending debounced writes vs. path swap.** Covered by the
  explicit flush in Phase 2, but if that flush is forgotten the bug
  is silent — the debounced write fires against old paths, which
  either no-op (writeFile to deleted parent succeeds because parent
  dir still exists) or recreate the old files. Write an explicit
  test that dirties the canvas, renames, and asserts the old paths
  do not reappear.

- **Component-name regex failure.** Unlike duplicate, rename fails
  hard on no-match rather than silently leaving the component name
  stale. This is the right call — a successful rename that leaves
  the TSX referencing a deleted CSS module would hard-break the
  page at render time. Error message should tell the user to
  restore the default `export default function <Name>()` signature
  before retrying.

- **Watcher double-fire on the active page.** chokidar will send
  `file:changed` for the new paths even with our suppression (the
  suppress window is 400ms and the writes happen inside the
  handler, so timing is usually fine but not guaranteed under
  load). The sync bridge's round-trip no-op guard is our backstop;
  verify under a slow disk by throttling fs calls during the
  integration test and confirming no flicker.

- **Active page load race.** After `setActivePageName(newName)`,
  the load effect re-parses the new files. If chokidar fires
  `file:changed` for the same new paths before React commits the
  new `activePageName`, the payload's `path` will still equal the
  new `activePage.tsxPath` once commit lands, and the bridge will
  parse+reload correctly. No action needed but worth noting.
