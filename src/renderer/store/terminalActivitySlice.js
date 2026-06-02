import { create } from 'zustand';
export const useTerminalActivityStore = create((set) => ({
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
}));
const hasForegroundProcess = (state) => {
    for (const v of Object.values(state.foregroundByTerminal)) {
        if (v !== null)
            return true;
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
export const selectAnyAgentActive = (state) => {
    if (state.userIntent === 'paused')
        return true;
    if (state.userIntent === 'resumed')
        return false;
    return hasForegroundProcess(state);
};
/**
 * Why the bridge should be paused, if it should. Returns `null` when
 * the bridge should be running. The bridge passes this to
 * `markPaused(reason)` so the indicator's popover can tell the user
 * what's going on.
 */
export const selectPauseReason = (state) => {
    if (state.userIntent === 'paused')
        return 'manual';
    if (state.userIntent === 'resumed')
        return null;
    return hasForegroundProcess(state) ? 'agent-terminal' : null;
};
