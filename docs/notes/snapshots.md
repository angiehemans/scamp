---
title: Project snapshots
related:
  - src/main/ipc/snapshotOps.ts
  - src/main/ipc/snapshot.ts
  - src/renderer/store/snapshotsSlice.ts
  - src/renderer/src/components/HistoryPanel.tsx
  - docs/plans/2026-06-18-project-snapshots.md
---

# Project snapshots

Persistent point-in-time copies of a project's page + component files,
stored inside the project so they travel with it. They're the safety net
for the overwrite bug: even when Scamp clobbers externally-written CSS,
the user can restore the last good state. The history **panel** shows
snapshots; **Cmd+Z / Cmd+Shift+Z** in-session undo is a separate system
(historySlice) and is unaffected.

## Storage layout

```
<project>/.scamp/
  snapshots.json            ← index: [{ id, timestamp, trigger, label, pageCount }]
  snapshots/<id>/           ← full file copies, mirroring the project tree
    app/page.tsx
    app/page.module.css
    app/<page>/page.*
    components/<Name>/<Name>.*
```

- `.scamp/` is already in the scaffolded `.gitignore` and already ignored
  by chokidar (`watcher.ts`), so snapshot writes never fire `file:changed`.
- The snapshot **folder is named by `id`** (`snap_<12 hex>`) — a stable
  1:1 mapping with the index entry (the PRD's timestamp-named folders were
  illustrative).
- Only `.tsx` + `.module.css` page/component files are captured —
  `theme.css` / `agent.md` / `next.config.ts` / `package.json` are not.
- Enumeration is a **direct byte walk** (not `parseCode`), so a malformed
  file an agent just wrote is captured faithfully.
- Limit **50** per project; the oldest is pruned (folder + index entry)
  when a new one would exceed it. (Cloud backup later lifts this.)

## Triggers

| Trigger | Where | Notes |
|---|---|---|
| `session_open` | `project.ts openProject` | Fire-and-forget before the canvas loads + before open-time scaffolding writes — captures what changed between sessions. The most important trigger. |
| `agent_edit` | `watcher.ts emitChange` | When `consumed === null` (no pending-write entry ⇒ external). 5-s collapse coalesces an agent's burst. Captures detection-time disk (the edit has already landed; the prior snapshot is the true pre-edit state). |
| `session_close` | `index.ts before-quit` + `App.tsx onClose` | From disk on app-quit; renderer flush + `snapshot:create` on in-app project close. |
| `manual` | History panel "Save snapshot" | User-typed name or "Manual snapshot". |
| `auto_save` | `useSnapshotAutoSave` | ≤ once per 5 min of canvas activity; gated by the `snapshotAutoSave` config flag (default on). |
| `before_restore` | inside `restoreSnapshot` | Snapshots the current state so a restore is itself undoable. |

All snapshot creation is **silent-fail** — `createSnapshot` never throws,
so a failed snapshot can't block opening/closing a project.

## Restore flow

1. Panel → `snapshot:restore` (renderer awaits).
2. Main: `before_restore` snapshot, then copy the snapshot's files back.
   Each copied file is registered as a **suppressed pending-write** so the
   watcher treats the burst as Scamp's own writes — no `agent_edit`
   snapshot, no per-file reload.
3. Main broadcasts `ProjectPagesChanged`; `App.tsx` re-reads the whole
   project from disk (its content-diffing merge picks up the restored
   pages) and the active page reloads through the normal load path.
4. The renderer clears the in-session undo stack (`clearAllHistory`) —
   you can't Cmd+Z back through a restore.

Restore is an **overlay** copy: files added after the snapshot are left in
place (not deleted).

## Cloud-backup foundation

`snapshots.json` + the per-snapshot folders map directly to the planned
cloud system: the index syncs to the project's Neon record, the folders to
R2, the local 50-limit becomes unlimited cloud history, and the local
`.scamp/` becomes a most-recent-50 cache. The panel UI is unchanged; cloud
snapshots appear in the same list.
