import { create } from 'zustand';
let nextToastId = 1;
/**
 * The save-status state machine lives in its own store so zundo's
 * temporal wrapper on `canvasSlice` doesn't capture these transitions
 * as undo steps, and so feature work can subscribe to save lifecycle
 * events without re-rendering on unrelated canvas changes.
 */
export const useSaveStatusStore = create((set) => ({
    state: { kind: 'saved' },
    toast: null,
    pauseStartedAt: null,
    markUnsaved: () => {
        set((s) => {
            // Skip-cases:
            //   `error` / `reloaded-from-disk` — terminal states that
            //      clear only on a successful save cycle (markSaving will
            //      transition them out).
            //   `saving` — a follow-on edit doesn't cancel the already-
            //      in-flight write, it just queues another debounce.
            //   `paused` / `diverged` — sync engine is intentionally not
            //      transitioning to `unsaved`; the in-memory diff grows
            //      under the existing label until the user resolves it.
            if (s.state.kind === 'error' ||
                s.state.kind === 'saving' ||
                s.state.kind === 'paused' ||
                s.state.kind === 'diverged' ||
                s.state.kind === 'reloaded-from-disk') {
                return s;
            }
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
    markPaused: (reason) => {
        set((s) => {
            // `error`, `saving`, and `reloaded-from-disk` are end-states
            // that we don't want to silently swallow — the user needs to
            // see them. `diverged` also stays put; pausing again after a
            // user already saw the diverged dialog would feel weird.
            if (s.state.kind === 'error' ||
                s.state.kind === 'saving' ||
                s.state.kind === 'reloaded-from-disk' ||
                s.state.kind === 'diverged') {
                return s;
            }
            // Already paused — refresh the reason if it changed but
            // preserve the original `pauseStartedAt` so the diverged-state
            // diff stays accurate across signal transitions.
            if (s.state.kind === 'paused') {
                if (s.state.reason === reason)
                    return s;
                return { state: { kind: 'paused', reason } };
            }
            return {
                state: { kind: 'paused', reason },
                pauseStartedAt: Date.now(),
            };
        });
    },
    markResumed: (divergedAttempt) => {
        set((s) => {
            if (s.state.kind !== 'paused')
                return s;
            if (divergedAttempt) {
                // Keep `pauseStartedAt` populated so the diverged popover
                // can filter history entries from during the pause.
                return { state: { kind: 'diverged', lastAttempt: divergedAttempt } };
            }
            return { state: { kind: 'saved' }, pauseStartedAt: null };
        });
    },
    markReloadedFromDisk: (file) => {
        set({ state: { kind: 'reloaded-from-disk', file } });
    },
    showToast: (message) => {
        const id = nextToastId++;
        set({ toast: { id, message } });
    },
    dismissToast: (id) => {
        set((s) => (s.toast?.id === id ? { toast: null } : s));
    },
}));
