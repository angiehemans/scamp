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
type TerminalActivityState = {
    foregroundByTerminal: Record<string, string | null>;
    /** Set or clear the foreground process for a pty. Removes the entry
     *  entirely when the pty exits to avoid stale keys. */
    setForeground: (terminalId: string, processName: string | null) => void;
    /** Forget about a terminal entirely (called on `onTerminalExit`). */
    removeTerminal: (terminalId: string) => void;
};
export declare const useTerminalActivityStore: import("zustand").UseBoundStore<import("zustand").StoreApi<TerminalActivityState>>;
/**
 * True iff any tracked terminal has a non-null foreground process
 * (i.e. anything other than the user's shell). Used by the sync
 * bridge to enter the agent-terminal pause state.
 */
export declare const selectAnyAgentActive: (state: TerminalActivityState) => boolean;
export {};
