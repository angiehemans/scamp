# Agent Coexistence — Implementation Plan

Goal: make Scamp safe to use while an external AI agent (Claude Code, Cursor Agent, etc.) is editing the same project files. Today, agent writes get silently overwritten by Scamp's canvas regen during ordinary use — this plan removes that failure mode and adds clear UI so the user always knows what the sync engine is doing.

The shape: four layers, landed in safety order. Phase 1 is the hotfix and the rest builds on it.

---

## The actual problem (one-line restatement)

Scamp's sync bridge treats all writes equally — canvas regen, debounced flush, format migration, chokidar reload. When two writes target the same file within ~200 ms, the loser silently overwrites the winner. Agents write in bursts (2-5 writes to the same file in seconds), which trips this race repeatedly.

The fix has three properties to enforce, in priority order:

1. **External edits always win at the file level.** If disk changed under us, never overwrite.
2. **Backoff from active edit zones.** Don't dispatch our own writes while bursts of external edits are landing.
3. **Surface state.** The user always knows whether their canvas changes are in-sync, paused, or diverged from disk.

---

## Phase 1 — External edit always wins (the hotfix)

**Goal:** stop the data-loss failure mode today. After this phase, an external editor's writes are never silently overwritten by Scamp, regardless of what else is happening.

**Depends on:** none. Should land before anything else.

### 1.1 Abort canvas-side writes when chokidar is mid-event — M, Medium

File: `src/renderer/src/syncBridge.ts`.

Today, `writeIfDirty` captures `expectedTsxContent = lastSerializedTsx` and dispatches the IPC. If chokidar fires for that path BETWEEN dispatch and the main process's `checkWriteConflict` reading disk, the renderer hasn't yet updated `lastSerialized` and the write proceeds against stale baselines.

**Action:** Track per-path "external edit pending" flags. When `onFileChanged` fires for a project file, set `externalEditPending[path] = true` and clear it once `reloadElements` has settled. Any `writeIfDirty` dispatch checks this flag before sending the IPC — if true for either tsxPath or cssPath, drop the write (no dispatch, no error, no toast).

**Acceptance:**
- Unit test on a `shouldDispatchWrite(path, flagState)` helper covering the four flag combinations.
- Integration test (vitest, no Electron): seed a project, mount the bridge, fire `onFileChanged` for `home.tsx`, then immediately call `writeIfDirty`. Assert no IPC was dispatched.

### 1.2 `onWriteConflict` is final — never re-dispatch — S, Low

File: `src/renderer/src/syncBridge.ts`.

The current conflict handler at `syncBridge.ts:413-453` already reloads from disk. But there's an ambient assumption elsewhere that conflicts are "retryable" — the save-status indicator's "Retry" button can re-dispatch the same attempt. After Phase 1, conflicts mean "the file moved under us" and retrying just creates a worse race.

**Action:** When `lastDispatchedAttempt` failed with a conflict (not a generic error), disable the Retry button and surface a different message: "Conflict — reloaded from disk." Use a separate save-status state if needed: `{ kind: 'reloaded-from-disk', file: string }`.

**Acceptance:** Retry button is hidden when the last failure was a conflict; visible for generic errors.

### 1.3 Surface aborted writes as a one-time toast — S, Low

File: `src/renderer/src/components/SaveStatusIndicator.tsx` (or wherever the status pill renders).

The user needs to know that a canvas edit didn't land because the file was externally edited. But spamming a toast on every chokidar event is noise.

**Action:** Show a single toast per abort: "Your canvas change wasn't saved — `home.tsx` was just edited externally." Auto-dismiss after 4 seconds. Throttled so multiple aborts in quick succession only show one toast.

**Acceptance:** Manual test — open project, edit canvas, externally `echo "..." > home.tsx`, see toast.

---

**Phase 1 total estimate:** ~2 days. Highest priority; ships as a hotfix.

---

## Phase 2 — Status indicator scaffolding

**Goal:** put the UI surface in place so Phases 3 and 4 have somewhere to render their state. Without this, the user can't tell why a save is paused.

**Depends on:** Phase 1.

### 2.1 Replace the binary save indicator with a four-state pill — M, Low

File: `src/renderer/src/components/SaveStatusIndicator.tsx` (and the underlying `src/renderer/store/saveStatusSlice.ts`).

Current states: `saved | unsaved | saving | error`. Add two more:

- **`paused`** — sync engine is intentionally not writing (Phase 3/4 will trigger this).
- **`diverged`** — sync engine is back online and noticed in-memory canvas state doesn't match disk; needs user choice.

The `saveStatusSlice` becomes the single source of truth for the indicator. The pill shows the current state with a colour + label and is click-to-expand for details on non-trivial states.

**Acceptance:** The indicator renders all four states from a Storybook-style component playground (or e2e test) by directly setting the slice value.

### 2.2 Click-to-expand details panel — S, Low

When the indicator is in `paused` or `diverged`, clicking it opens a small popover:

- **`paused`**: "Sync paused — external editor is writing to this project. Canvas edits will resume when activity settles. [Resume now]"
- **`diverged`**: "Canvas edits haven't been saved because the file changed externally. [Save canvas to disk] [Discard canvas, keep disk]"

**Acceptance:** Each state has its labelled actions wired (no-op for now; Phases 3 + 5 wire them).

### 2.3 Save-status slice schema bump — S, Low

File: `src/renderer/store/saveStatusSlice.ts`.

Add the two new variants to the discriminated union. Maintain the existing transitions (saved → unsaved → saving → saved); add transitions:
- any → `paused` (Phase 3/4 entry).
- `paused` → `saved` (resume + nothing dirty).
- `paused` → `diverged` (resume + dirty in-memory state differs from disk).
- `diverged` → `saved` (user picked Save or Discard).

**Acceptance:** Unit tests on the transitions; existing save-status integration tests still pass.

---

**Phase 2 total estimate:** ~2 days.

---

## Phase 3 — Universal post-chokidar quiet window

**Goal:** absorb agent write-bursts gracefully without any agent detection. After this phase, an external editor running anywhere (Scamp's terminal, system terminal, VSCode, etc.) gets a quiet window to land all its writes before Scamp resumes its own.

**Depends on:** Phases 1 + 2.

### 3.1 Quiet-window tracker — M, Medium

File: `src/renderer/src/syncBridge/quietWindow.ts` (new).

```ts
const QUIET_WINDOW_MS = 2500;

export type QuietWindowState = {
  /** Project-wide quiet window — set when any project file gets a
   *  chokidar event. Rolls forward on each subsequent event. */
  quietUntil: number;
};

export const isQuiet = (state: QuietWindowState, now = Date.now()): boolean =>
  now < state.quietUntil;

export const extendQuiet = (
  state: QuietWindowState,
  now = Date.now()
): QuietWindowState => ({ quietUntil: now + QUIET_WINDOW_MS });
```

Pure helpers, fully unit-testable.

**Acceptance:** Unit tests covering: not quiet initially, quiet after extend, rolls forward on second extend, expires after window.

### 3.2 Wire into `syncBridge` — M, Medium

File: `src/renderer/src/syncBridge.ts`.

- On every `onFileChanged` for a project-owned file (not `theme.css`, not `agent.md`), call `extendQuiet`.
- Before dispatching any canvas-driven write (`writeIfDirty` flush path), check `isQuiet(...)`. If true: skip dispatch, set save-status to `paused`, and queue the canvas state for later flush.
- When the quiet window expires (set a timer for the remaining duration), check whether canvas state differs from `lastSerialized`. If yes → `diverged`. If no → `saved`.

The pause applies to all project files (the simpler all-files model from the recommendation discussion). `theme.css` writes are exempt because they don't conflict with the canvas pipeline.

**Acceptance:**
- Integration test (vitest, no Electron): set up the bridge, fire two chokidar events 1 s apart, dispatch a canvas write at the 2 s mark. Assert no IPC fired; assert status went `paused`. Advance fake time past the quiet window. Assert status went `diverged` (since the canvas had pending state).
- E2E test (playwright, with stub agent writes): write to a project file externally, see status pill flip to `paused` within 1 s.

### 3.3 `Resume now` user override — S, Low

When the user clicks `Resume now` on the popover (Phase 2.2):
- Force `quietUntil = 0`.
- Run the flush immediately.

**Acceptance:** Clicking Resume mid-quiet-window dispatches the write and clears the pause.

---

**Phase 3 total estimate:** ~3 days.

---

## Phase 4 — Terminal-busy heuristic (auto-detection)

**Goal:** detect agents running in Scamp's integrated terminal so the user sees the pause kick in IMMEDIATELY when they start a Claude session (rather than waiting for the first file write to land).

**Depends on:** Phases 2 + 3. This phase adds another trigger for the `paused` state; nothing else changes downstream.

### 4.1 PTY foreground-process tracking — M, Medium

File: `src/main/ipc/terminal.ts`.

`node-pty` exposes the pty file descriptor. On Linux/macOS we can read `/proc/<pid>/stat` (Linux) or `tcgetpgrp` via ioctl (macOS) to discover the current foreground process group leader of the pty.

**Action:** Add a polling loop (every ~500 ms while the terminal panel is open) that reports the current foreground process command name to the renderer. New IPC event: `terminal:foreground-process` with payload `{ terminalId, processName: string }`. When the foreground process is the user's shell (`bash`, `zsh`, `fish`, `sh`, or the configured `SHELL` env var), report `null`.

For Windows, defer (Phase 4.4). The other layers still protect.

**Acceptance:** Unit test the parser (`/proc/<pid>/stat` format) on Linux. Manual smoke test on macOS — open terminal, run `claude`, see the event fire with `claude`.

### 4.2 Renderer-side activity store — S, Low

File: `src/renderer/store/terminalActivitySlice.ts` (new).

```ts
type TerminalActivityState = {
  /** Per-terminal foreground process name, or null when at a shell prompt. */
  foregroundByTerminal: Record<string, string | null>;
  /** True if any terminal has a non-shell foreground process. */
  anyAgentActive: boolean;
};
```

Subscribe to `onTerminalForegroundProcess` and maintain. `anyAgentActive` derived from `foregroundByTerminal`.

**Acceptance:** Unit tests on the slice; selector returns the right derived state.

### 4.3 Wire into `syncBridge` — S, Low

File: `src/renderer/src/syncBridge.ts`.

Before dispatching a canvas write, ALSO check `anyAgentActive`. If true: same path as quiet-window — skip dispatch, status → `paused`.

When `anyAgentActive` flips from true → false: same logic as quiet-window expiry. Check canvas vs lastSerialized; transition to `saved` or `diverged`.

Note: this is in ADDITION to Phase 3's chokidar-based pausing, not a replacement. Pause is the union of both signals; they cover overlapping but not identical cases.

**Acceptance:** Integration test: directly set `anyAgentActive = true`, dispatch a canvas write, assert no IPC. Clear the flag, assert flush fires.

### 4.4 Windows fallback — S, Low

PTY-process introspection on Windows is more involved (no `/proc`, ConPTY has limited APIs). Documentation only — `docs/notes/agent-coexistence.md` calls out that auto-detection is Linux + macOS only; Windows users get only the Phase 3 quiet-window protection.

**Acceptance:** Docs entry exists.

---

**Phase 4 total estimate:** ~4 days (the pty polling is the long pole).

---

## Phase 5 — Diverged-state UX polish

**Goal:** when the user has canvas edits that didn't write (because of agent activity), give them a clear, non-destructive resolution path.

**Depends on:** Phases 1-3.

### 5.1 Diverged-state diff preview — M, Medium

When the indicator goes `diverged`, the popover should show a brief diff: which files have in-memory canvas changes not on disk, and a 3-line summary of what changed (e.g. "`rect_a1b2`: position changed; `hero_0b01`: padding changed"). This prevents the user from picking Save or Discard blind.

File: `src/renderer/src/components/DivergedDialog.tsx` (new) — a small dialog the popover opens to.

**Action:** Reuse the existing `historyTypes.ts` action-kind labels to summarize what's pending. The store already tracks history entries; the diverged dialog reads the last N entries since the bridge went `paused`.

**Acceptance:** Manual test — draw a rect, externally edit `home.tsx`, click status pill. Dialog shows "draw-rect" with the new class name.

### 5.2 Save / Discard actions wire through — S, Low

- **Save**: force `quietUntil = 0`, dispatch the canvas write with NO `expectedTsxContent` (force overwrite — user explicitly chose canvas wins).
- **Discard**: reload from disk via `parseCode` + `reloadElements`, clear history past the divergence point.

**Acceptance:** Both buttons land their intended state on disk + canvas. Save preserves the user's edits; Discard restores disk.

### 5.3 Per-file conflict granularity (optional) — L, Medium

The all-files pause is simple. A nice future addition: pause writes only to files that were just externally edited, letting the user keep editing OTHER pages on the canvas. Requires per-file save-status tracking and a more nuanced indicator. Probably not worth it for v1.

**Defer until** real-world usage shows the all-files pause is too aggressive.

---

**Phase 5 total estimate:** ~3 days for 5.1 + 5.2. 5.3 deferred.

---

## Phase 6 — Documentation + observability

**Goal:** make the new behaviour understandable to both users and future agents working on Scamp.

**Depends on:** all earlier phases.

### 6.1 `docs/notes/agent-coexistence.md` — S, Low

Cover:
- The four save-status states and what triggers each.
- The two pause signals (quiet window + terminal-busy).
- Which files are exempt (`theme.css`, `agent.md`, `scamp.config.json`).
- Per-OS notes (Windows fallback).
- How to opt out (the Resume button).

Replaces the dangling references to `docs/known-issues.md` (which itself doesn't exist).

### 6.2 Update `agent.md` template — S, Low

File: `src/shared/agentMd.ts`.

Add a section to the user-facing `agent.md` explaining what happens when Claude edits files while Scamp is open. Reassures the user (and any agent reading the file) that the bidirectional sync is now safe.

### 6.3 Telemetry hook for the pause signal (optional) — S, Low

If Sentry is enabled, fire a non-PII event when:
- A pause is triggered (which signal: terminal vs chokidar).
- A diverged state is resolved (which option: save vs discard).
- A write is aborted by Phase 1.

Helps tune `QUIET_WINDOW_MS` and identify whether one signal is doing all the work.

---

**Phase 6 total estimate:** ~1 day.

---

## Suggested rollout schedule

| Week | Phase | Why |
|---|---|---|
| 1 | Phase 1 | Hotfix — stops data loss today. Ship before anything else. |
| 1 | Phase 2 | UI scaffolding — unblocks Phases 3 + 5. |
| 2 | Phase 3 | First real protection layer. Works for all editor positions. |
| 2 | Phase 5 | Diverged UX. Pairs with Phase 3 since 3 is what triggers diverged. |
| 3 | Phase 4 | Terminal heuristic. Makes the pause feel instantaneous in the common case. |
| 3 | Phase 6 | Docs + telemetry. |

**Total: ~3 weeks of focused work.** Phase 1 alone (~2 days) is the must-ship-first piece.

---

## Decisions baked into this plan

These came out of the recommendation discussion and are committed unless flagged for review:

1. **Canvas edits made during pause are kept in memory** and require user confirmation (Save / Discard) before landing on disk. NOT silently flushed.
2. **`theme.css`, `agent.md`, `scamp.config.json` are exempt** from agent-mode pausing.
3. **v1 pauses ALL files when any one is being externally edited** (project-wide pause). Per-file granularity is Phase 5.3 (deferred).
4. **Toast appears only when Scamp aborts a canvas-side write** (Phase 1.3). All other state changes show on the status pill silently.
5. **Windows users get Phases 1 + 3 only.** No terminal heuristic auto-detection on Windows in v1.
6. **The `Resume now` override is always available** in the popover — the user can force a flush even mid-quiet-window if they know what they're doing.

---

## Open questions for your review

1. **Quiet window duration.** 2.5 s is my default. Too long for users typing fast on the canvas (they'd notice the lag); too short for slow networks where an agent's writes are spaced. Could expose as a setting in `scamp.config.json` — worth it, or wait for telemetry?
2. **What happens to the debounced canvas writer DURING pause?** Two options: (a) the existing 200ms debounce fires but `writeIfDirty` short-circuits, (b) we cancel the debounce timer entirely when entering pause. Option (b) is cleaner but means resuming requires a fresh debounce cycle. Recommend (b).
3. **Auto-resume vs auto-stay-paused** when the quiet window expires but `anyAgentActive` is still true (e.g. Claude is sitting at a "do this next?" prompt). Two interpretations: (i) we stay paused until BOTH signals clear, (ii) we resume when EITHER clears. Recommend (i) — the cost of staying paused longer is small; the cost of resuming too early and clobbering an agent mid-thought is large.
4. **What counts as a "non-shell" foreground process?** Naive: anything other than the configured `SHELL` env var. Better: a small allow-list of known agents (`claude`, `claude-code`, `cursor-agent`, `aider`) plus a fallback to "any non-shell command takes more than 5 s." Recommend starting naive; the over-trigger from `npm install` is harmless (just a brief pause, no data loss).
5. **Where does the toast actually live** — the existing save-status indicator area or a separate notification region? If we get to a real toast system later, this should slot into it. For v1, a single-line strip below the toolbar is probably enough.

---

## Cross-references to other plans

- `docs/code-quality-plan.md` Phase 5.4 — split `syncBridge.ts` into a folder. The work here should land BEFORE that split because it adds new bridge behaviour; refactoring after this lands gives us a clean target.
- `docs/code-quality-review.md` § 5 — usability concerns flagged the 2-second ack watchdog and the silent `window.alert` fallback. Both intersect this plan; address inline as the related code is touched.
- `docs/adobe-typekit-plan.md` Phase 2.2 — the Adobe-fetch resolver also uses chokidar's `onThemeChanged` path. Should be unaffected by Phase 1 (theme.css is exempt) but worth a manual smoke test.
