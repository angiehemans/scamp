import { create } from 'zustand';

/**
 * Tracks which Scamp-integrated terminals currently have a non-shell
 * foreground process. Updated by the bridge subscription in
 * `terminalActivityBridge.ts` (renderer-side) that listens for the
 * main process's `terminal:foregroundProcess` events.
 *
 * The bridge between this slice and the sync engine lives in
 * `syncBridge.ts` (Phase 4.3) — it subscribes to `anyAgentActive`
 * and transitions the save status accordingly.
 *
 * Keys are pty ids (the same id returned by `createTerminal`).
 * Values are the foreground command name when an agent-like process
 * is running, or `null` when the pty is at a shell prompt.
 *
 * `anyAgentActive` is derived (via the `selectAnyAgentActive`
 * selector) — true iff at least one entry has a non-null value.
 */
/**
 * What the user has decided about sync, overriding auto-detection
 * if they want to. Project switch resets to `'auto'` so a manual
 * choice doesn't bleed across sessions.
 *
 *   - `'auto'`     — follow auto-detection (default). Bridge pauses
 *                    when an agent is detected in any integrated
 *                    terminal; resumes when the foreground clears.
 *   - `'paused'`   — user explicitly engaged Pause. Bridge stays
 *                    paused regardless of detection.
 *   - `'resumed'`  — user explicitly clicked Resume from a paused
 *                    state. Bridge stays resumed regardless of
 *                    detection. The user has acknowledged the
 *                    agent and chosen to override; subsequent
 *                    agent activity won't re-pause until they
 *                    click Pause again or switch projects.
 */
export type UserSyncIntent = 'auto' | 'paused' | 'resumed';

type TerminalActivityState = {
  foregroundByTerminal: Record<string, string | null>;
  userIntent: UserSyncIntent;
  /** Set or clear the foreground process for a pty. Removes the entry
   *  entirely when the pty exits to avoid stale keys. */
  setForeground: (terminalId: string, processName: string | null) => void;
  /** Forget about a terminal entirely (called on `onTerminalExit`). */
  removeTerminal: (terminalId: string) => void;
  /** Update the user's explicit sync intent. The save-indicator
   *  dropdown calls this. */
  setUserIntent: (intent: UserSyncIntent) => void;
};

export const useTerminalActivityStore = create<TerminalActivityState>(
  (set) => ({
    foregroundByTerminal: {},
    userIntent: 'auto',
    setForeground: (terminalId, processName) => {
      set((s) => ({
        foregroundByTerminal: {
          ...s.foregroundByTerminal,
          [terminalId]: processName,
        },
      }));
    },
    removeTerminal: (terminalId) => {
      set((s) => {
        const next = { ...s.foregroundByTerminal };
        delete next[terminalId];
        return { foregroundByTerminal: next };
      });
    },
    setUserIntent: (intent) => {
      set({ userIntent: intent });
    },
  })
);

const hasForegroundProcess = (state: TerminalActivityState): boolean => {
  for (const v of Object.values(state.foregroundByTerminal)) {
    if (v !== null) return true;
  }
  return false;
};

/**
 * True iff the bridge should be paused. Layered:
 *
 *   1. If the user explicitly chose `'paused'` → paused.
 *   2. If the user explicitly chose `'resumed'` → never paused, even
 *      if an agent is detected. The user has acknowledged the agent
 *      and elected to override.
 *   3. Otherwise (auto), pause iff at least one tracked terminal has
 *      a non-null foreground process.
 */
export const selectAnyAgentActive = (
  state: TerminalActivityState
): boolean => {
  if (state.userIntent === 'paused') return true;
  if (state.userIntent === 'resumed') return false;
  return hasForegroundProcess(state);
};

/**
 * Why the bridge should be paused, if it should. Returns `null` when
 * the bridge should be running. The bridge passes this to
 * `markPaused(reason)` so the indicator's popover can tell the user
 * what's going on.
 */
export const selectPauseReason = (
  state: TerminalActivityState
): 'manual' | 'agent-terminal' | null => {
  if (state.userIntent === 'paused') return 'manual';
  if (state.userIntent === 'resumed') return null;
  return hasForegroundProcess(state) ? 'agent-terminal' : null;
};
