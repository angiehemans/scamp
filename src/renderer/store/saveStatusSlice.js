import { create } from 'zustand';
/**
 * The save-status state machine lives in its own store so zundo's
 * temporal wrapper on `canvasSlice` doesn't capture these transitions
 * as undo steps, and so feature work can subscribe to save lifecycle
 * events without re-rendering on unrelated canvas changes.
 */
export const useSaveStatusStore = create((set) => ({
    state: { kind: 'saved' },
    markUnsaved: () => {
        set((s) => {
            // `error` persists through new edits — it only clears on a
            // successful save. Ditto `saving`: a follow-on edit doesn't cancel
            // the already-in-flight write, it just queues another debounce.
            if (s.state.kind === 'error' || s.state.kind === 'saving')
                return s;
            return { state: { kind: 'unsaved' } };
        });
    },
    markSaving: (attempt) => {
        set({ state: { kind: 'saving', attempt } });
    },
    markConfirmed: () => {
        set((s) => {
            // Only advances from `saving` — a stray ack without a pending
            // save shouldn't flip an error or a clean state.
            if (s.state.kind !== 'saving')
                return s;
            return { state: { kind: 'saved' } };
        });
    },
    markError: (message, attempt) => {
        set({ state: { kind: 'error', message, lastAttempt: attempt } });
    },
    markClean: () => {
        set((s) => {
            if (s.state.kind !== 'unsaved')
                return s;
            return { state: { kind: 'saved' } };
        });
    },
}));
