import { create } from 'zustand';
export const useTerminalActivityStore = create((set) => ({
    foregroundByTerminal: {},
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
}));
/**
 * True iff any tracked terminal has a non-null foreground process
 * (i.e. anything other than the user's shell). Used by the sync
 * bridge to enter the agent-terminal pause state.
 */
export const selectAnyAgentActive = (state) => {
    for (const v of Object.values(state.foregroundByTerminal)) {
        if (v !== null)
            return true;
    }
    return false;
};
