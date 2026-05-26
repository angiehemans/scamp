---
title: Component editor sync + target swap
related:
  - src/renderer/src/syncBridge.ts
  - src/main/pendingWrites.ts
  - src/main/ipc/file.ts
  - src/renderer/src/components/ProjectShell.tsx
---

# Component editor sync + target swap

The canvas store has a single "active edit target" — either a page OR a component — and the sync bridge tracks every store mutation, debounces a write to that target's file pair, and reacts to chokidar events from disk. Everything else here is consequence of that one rule.

## The flow on every edit

1. User mutates the canvas (drag, type, etc.) → Zustand `set()` updates `state.elements`.
2. The sync-bridge subscription fires.
3. If `state.activePage` / `state.activeComponent` changed since `prev`, that's a **target swap** — see below.
4. Otherwise it's a "genuine canvas edit": mark unsaved, regenerate preview code via `generateCode`, mirror into `state.pageSource` so the bottom code panel reflects what's about to be written, schedule a `setTimeout(flushDebouncedWrite, 500ms)`.
5. After 500ms (or sooner if `flushPendingPageWrite` is called), `writeIfDirty` runs: regen, compare to `lastSerializedTsx/Css`, dispatch a `writeFile` IPC if dirty.

`lastSerializedTsx/Css` are local closure variables. They hold the last content the sync bridge wrote for the CURRENT target. The dedupe ("if code === lastSerialized → markClean and return") is what keeps idle canvases from burning IPC traffic on every Zustand tick.

## Target swap (page → component, component → page, or rename)

When `state.activeComponent !== prev.activeComponent || state.activePage !== prev.activePage`:

1. Cancel any pending debounce timer.
2. **Flush the OUTGOING target.** Call `writeIfDirty(prev.elements, prev.rootElementId, prevTarget)`. This is the "don't lose unsaved edits when switching pages" guarantee.
3. Reset `lastSerialized` to null so the next write to the NEW target doesn't false-positive dedupe against the OLD target's content.

### Suppression for destructive multi-file ops

The outgoing flush is wrong for two specific operations: component **rename** and component **delete**. By the time the target swap fires, the outgoing file path has already been removed from disk (rename moves it; delete unlinks it). `writeIfDirty` would `dispatchPageWrite` against a deleted path, atomicWrite would ENOENT, and the renderer's catch would surface "Save failed" with a retry button — even though the destructive operation itself succeeded.

The fix is a one-shot flag in `syncBridge.ts`:

- `armTargetSwapSuppression()` — sets the flag. Called by `handleRenameComponent` and `handleConfirmDeleteComponent` BEFORE the file ops start.
- The next target-swap branch consumes the flag and skips the outgoing `writeIfDirty`.
- 5-second TTL auto-clears the flag if no swap actually happens (e.g. user wasn't inside the renamed/deleted component, so no transition fires). Without the TTL, a forgotten arm would silently mute the next legitimate swap's flush.
- `disarmTargetSwapSuppression()` — explicit clear, called from the error path so a failed multi-file op doesn't leak suppression.

## The pending-write tracker overwrite-ack

Separate from the suppression: `src/main/pendingWrites.ts` tracks which file paths the renderer just wrote, so chokidar events for those files can be ack'd without re-broadcasting (the renderer generated the content; re-parsing would just flicker).

The wrinkle: when two writes to the same path land in quick succession (e.g. syncBridge's debounced flush followed by an explicit rewrite during a component rename), the second `register()` used to overwrite the first entry and silently drop its `writeId`. Chokidar fires once, acks the second writeId, and the renderer's `pendingSaves` tracker for the FIRST writeId waits 2s for an ack that never arrives → false "Save failed".

Fix: in `pendingWrites.register`, when overwriting an existing entry, ack the previous `writeId` immediately. The new write supersedes the old on the same path; any tracker waiting on that path can confirm.

## Functional-updater rule for `onProjectChange`

`ProjectShell.tsx` exposes `onProjectChange` as `(next: ProjectData | ((prev) => ProjectData)) => void`. Multi-step handlers MUST use the functional form when they fire more than one `onProjectChange` in the same synchronous handler — React 18 batches and value-based updates clobber each other (each `setProject(obj)` replaces the queued value rather than composing).

The convert-to-component flow burned this hard once: `handleConvertToComponent` called `onProjectChange({...project, components: NEW})` then `openComponent → persistActiveSource → onProjectChange({...project, pages: NEW})`. Both spread the same closure `project`, so the second call's `pages` update arrived with stale `components` and the new component disappeared from React state. The downstream useEffect saw no matching component, reset the canvas, and the resulting reload pulled `project.pages[home].tsxContent` — which by then held the component's body (the chokidar re-read had merged disk state in). The on-disk page file ended up byte-identical to the component file.

Always functional updaters in handlers that call more than one project mutation.
