# Plan: Project Snapshots

_Status: **APPROVED — in progress.** D1 disk-capture, D2 replace-panel, D3 `snapshotAutoSave` flag, D4 both close hooks — all confirmed by reviewer. Source PRD: persistent local snapshots stored in `.scamp/`. Written 2026-06-18._

A persistent snapshot system that saves the full state of a project at meaningful moments, stored inside the project folder (`.scamp/`). Snapshots survive sessions, protect against accidental overwrites, and lay the groundwork for cloud backup. The history **panel** is repurposed to show snapshots; **Cmd+Z / Cmd+Shift+Z** in-session undo is unchanged.

---

## What the research changed about the PRD

Three PRD line-items are **already done** in the codebase:

- **`.scamp/` is already in `.gitignore`** for both project formats (`projectScaffold.ts`, written on scaffold, comment: _"Scamp local state (component thumbnails, etc.)"_). No change needed.
- **`.scamp/` is already ignored by chokidar** (`watcher.ts`: `ignored: [/(^|[\/\\])\../, …]`), so snapshot writes won't fire `file:changed`. No change needed.
- **`.scamp/` is an established convention** — component thumbnails live in `.scamp/component-thumbs/`. We mirror that exact pattern (`snapshotOps` ≈ `componentOps`'s thumbnail handlers).

So storage/gitignore/watcher groundwork exists. The real work is: a main-side snapshot module, the triggers, and replacing the panel's data source.

---

## Architecture decisions

1. **Main owns all file I/O** (PRD requirement) — new `src/main/ipc/snapshotOps.ts` (pure logic) + `snapshot.ts` (IPC adapter) + `registerSnapshotIpc()` in `index.ts`, matching the post-4.7 Ops/handler split. The renderer only sends IPC.
2. **Main always snapshots from disk**, walking the project itself (legacy = flat `*.tsx`/`*.module.css` at root; nextjs = `app/**` + `components/**`). Single source of truth, captures *all* pages/components (not just the active one), and works at session-open before the renderer has `ProjectData`.
3. **Renderer-initiated triggers flush first.** For triggers where the canvas may be ahead of disk (manual, auto-save, session-close, before-restore), the renderer calls `flushPendingPageWrite()` *then* `snapshot:create`, so the snapshot includes unsaved canvas edits. Session-open and agent-edit snapshot disk directly (canvas isn't ahead).
4. **Panel decoupled from the undo stack.** `historySlice` stays 100% intact and keeps driving Cmd+Z / Cmd+Shift+Z. We rewrite `HistoryPanel.tsx` to read a *new* snapshot store instead of the undo buckets. The undo stack becomes keyboard-only (no visible panel), as the PRD's comparison table implies.

---

## Design decisions to confirm

| # | Decision | Recommendation |
|---|---|---|
| **D1** | **Agent-edit "pre-edit" capture.** By the time chokidar fires, the agent has *already written disk* (awaitWriteFinish settles first), so there is no pre-edit content on disk for the changed file. | Snapshot **current disk** at detection time. The "last good state" before a bad agent edit is then the *previous* snapshot (session-open / prior auto-save). The PRD's "most important trigger" (session-open) is the real safety net; agent-edit is a bonus mid-session restore point. Alternative (more complex, partial): have the renderer contribute the active page's last-synced content — but that only covers one page. **Recommend disk-capture.** | go with recommendation
| **D2** | **Replace the undo panel entirely?** The current History panel *is* the Cmd+Z visualization. | **Yes** — repurpose it to show snapshots (PRD says "replaces"). Cmd+Z keeps working with no panel. Confirm you're OK losing the visual undo-stack list. | confirmed
| **D3** | **Auto-save (5-min) setting.** PRD says it can be disabled in settings. | Ship **on** with a `snapshotAutoSave?: boolean` flag in `scamp.config.json` (reuse the existing `ProjectConfig` opt-out pattern, like `agentMdManaged`). | agreed
| **D4** | **Session-close on app-quit.** Renderer `onClose` is easy; full app-quit needs a main `before-quit` hook (currently only disposes watchers/terminals). | Cover the common path (project `onClose`) **and** add the `before-quit` disk-snapshot in main. Both read current disk. | sounds good.

---

## Phased implementation

### Phase A — Main-side storage core (no UI, fully testable) — ✅ DONE

Committed on `feature/project-snapshots`. `snapshotOps.ts` + `snapshot.ts` handler + `registerSnapshotIpc` + preload methods + IPC channels + types. 29 new tests (unit + integration), full typecheck (node+web) clean, 1538 tests pass. Notes/deviations: snapshot folders are named by `id` (not timestamp) for a stable 1:1 mapping; labels are concise (no embedded date — the panel renders time from `timestamp`); restore is an overlay copy (files added after the snapshot are left in place — Phase E decides whether to also remove them); enumeration is a direct byte walk so even malformed files are captured.

The foundation; everything here is unit/integration-testable without the app running.

- **`src/shared/ipcChannels.ts`** — add `SnapshotCreate` / `List` / `ListResult` / `Restore` / `RestoreComplete` / `Delete`.
- **`src/shared/types.ts`** — `SnapshotTrigger` (`'session_open' | 'agent_edit' | 'session_close' | 'manual' | 'auto_save' | 'before_restore'`), `SnapshotMeta`, and the create/list/restore/delete arg+result types.
- **`src/main/ipc/snapshotOps.ts`** (pure logic):
  - `enumerateProjectFiles(projectPath, format)` — walk app/components (reuse/adapt `pagePathsFor` logic from `projectScaffold`).
  - `createSnapshot(projectPath, format, trigger, label?)` — copy files into `.scamp/snapshots/<id>/`, write/update `.scamp/snapshots.json`, enforce the **50-limit** (prune oldest folder + entry), apply **5-s agent-edit collapse**, **silent-fail** on disk/permission errors.
  - `listSnapshots`, `deleteSnapshot`, `restoreSnapshot` (snapshots `before_restore` first, then copies files back).
  - Pure helpers worth isolating for tests: `pruneToLimit`, `shouldCollapseAgentEdit`, `snapshotIdFor`, `formatTriggerLabel`.
- **`src/main/ipc/snapshot.ts`** + **`registerSnapshotIpc()`** in `index.ts`; **`src/preload/index.ts`** methods (invoke for create/list/restore/delete, `onSnapshotRestoreComplete` subscription).
- **Tests:**
  - `test/snapshotOps.test.ts` (unit, temp dirs, real fs): create writes folder+json; list sorts newest-first; **prune at 51 drops oldest folder+entry**; **5-s collapse** skips/merges; delete removes both; malformed/missing `snapshots.json` tolerated; **simulated write failure stays silent** (no throw).
  - `test/integration/snapshotOps.integration.test.ts`: scaffold a real legacy + nextjs project → create → assert `.scamp/snapshots/<id>/` mirrors `app/`+`components/` → restore → assert files copied back + a `before_restore` entry exists → list reflects state.

### Phase B — Triggers (main + lifecycle)

- **Session open** — fire-and-forget `createSnapshot(..., 'session_open')` inside main's `openProject()` *before* returning `ProjectData` (non-blocking; never delays load).
- **Agent edit** — in `watcher.ts` `emitChange`, *after* the existing self-write/pending-write suppression confirms it's genuinely external, call `createSnapshot(..., 'agent_edit', filename)` (collapse lives in `snapshotOps`). Must **not** fire for `.scamp/` (already ignored) or for restore-driven writes (guarded in Phase E).
- **Session close** — main `before-quit` snapshots the active project from disk; renderer `ProjectShell.onClose` calls `flushPendingPageWrite()` then `snapshot:create('session_close')`.
- **Tests:** unit-test the collapse/trigger-label helpers; an integration test that simulates two external edits <5 s apart producing one snapshot; assert a session-open snapshot exists after `openProject` against a scaffolded project.

### Phase C — Renderer integration (the UI)

- **`src/renderer/store/snapshotsSlice.ts`** (new) — snapshot list, `loadSnapshots()` (via `snapshot:list`), `createSnapshot`, `restoreSnapshot`, `deleteSnapshot`, subscribe to `snapshot:restore:complete`. Pure helpers (`relativeTime`, `triggerIcon`, sort) extracted for unit tests.
- **Rewrite `HistoryPanel.tsx`** — same visual design (list, per-trigger icon, label, relative-time with absolute-on-hover, page count, "Now" marker at top), now reading `snapshotsSlice`. Add the **"Save snapshot"** button (name prompt → `manual`) and the **restore confirm dialog** (reuse `ConfirmDialog`, PRD copy).
- **Wire-up** in `ProjectShell`/`useActiveTarget`: load snapshots on project open; on `restore:complete`, **clear the in-session undo stack** (`clearAllHistory`) and re-read `ProjectData` so non-active pages refresh.
- **Auto-save (5-min)** — a renderer timer keyed to "continuous canvas activity," gated by the `snapshotAutoSave` config flag (D3); flushes then `snapshot:create('auto_save')`.
- **Tests:** unit-test the pure slice helpers (relative-time buckets, trigger→icon map, newest-first sort, "Now" marker logic). Component rendering consistency with the existing panel approach.

### Phase D — Scaffold + docs

- **`src/shared/templates/agentMd.ts`** — add the PRD's "## Snapshot history" section to both `AGENT_MD_CONTENT` and `AGENT_MD_CONTENT_LEGACY` (auto-refreshed on open via `refreshAgentMdIfNeeded`). **Locate and update any agent.md golden/content test.**
- **`.gitignore`** — already covers `.scamp/`; verify in an integration assertion (no code change).
- **`docs/notes/snapshots.md`** — storage layout, triggers, restore flow, undo-stack relationship, and the cloud-backup mapping (PRD foundation section), referenced from the new modules.

### Phase E — Restore reliability + save-pipeline interaction (risk area)

The restore reload intersects the live save pipeline (the subsystem the PRD calls buggy), so it gets its own hardening pass:

- A **restore-in-progress guard** in main so the burst of restore writes doesn't spawn `agent_edit` snapshots and doesn't fight the renderer's quiet-window/conflict logic.
- Ensure **all** restored pages reload (active page via `file:changed`; others via `ProjectData` re-read), and the undo stack is cleared (PRD: "you cannot Cmd+Z back through a restore").
- **Tests:** integration test of the full restore round-trip (create → mutate files → restore → assert disk matches snapshot + a `before_restore` snapshot exists + no `agent_edit` snapshot was spawned by the restore writes).

---

## Consolidated test inventory

- **New unit:** `test/snapshotOps.test.ts` (create/list/prune-at-50/collapse/delete/silent-fail/malformed-json) + pure-helper tests for the renderer slice helpers and the collapse/label helpers.
- **New integration:** `test/integration/snapshotOps.integration.test.ts` (scaffold→create→restore→list, legacy + nextjs), session-open-on-open, 5-s collapse, and the Phase-E restore round-trip.
- **Updated:** the agent.md template content test (Phase D); any `ProjectData`/scaffold assertions touching `.gitignore`.
- Convention matched throughout: vitest, real `os.tmpdir()` temp dirs, **no fs mocking**, cleanup in `afterEach` — same as the existing `*Ops` tests.

---

## Risks & out of scope

- **Top risk:** restore ↔ save-pipeline interaction (Phase E). Restore writes go through the same chokidar/quiet-window machinery the PRD says has an overwrite bug; isolated into its own phase with a guard + round-trip test.
- **D1 nuance:** agent-edit captures detection-time disk, not true pre-edit — confirm the recommendation.
- **Out of scope (per PRD):** the actual overwrite-bug fix (separate), and cloud backup (we only keep the `.scamp/` + `snapshots.json` shape cloud-compatible).

---

## Build order

Phase A first (fully-testable foundation), then check in before wiring triggers (B), UI (C), scaffold/docs (D), and the restore-hardening pass (E).

## Open questions for reviewer

1. Confirm **D1–D4**.
2. Anything in the PRD's panel UX that should differ from the current panel beyond the data source?
3. Is the `snapshotAutoSave` opt-out per-project (in `scamp.config.json`) the right scope, or global app settings?
