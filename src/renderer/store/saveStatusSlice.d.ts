/**
 * Enough to re-issue the failed IPC call for a retry, without asking
 * the canvas store again (its state may have moved on since the
 * original attempt).
 */
export type LastWriteAttempt = {
    kind: 'write';
    tsxPath: string;
    cssPath: string;
    tsxContent: string;
    cssContent: string;
} | {
    kind: 'patch';
    cssPath: string;
    className: string;
    newDeclarations: string;
    /**
     * Media scope for the patch, when it targets an `@media
     * (max-width: Npx)` block. Omitted for base-class patches.
     */
    media?: {
        maxWidth: number;
    };
};
export type SaveState = {
    kind: 'saved';
} | {
    kind: 'unsaved';
} | {
    kind: 'saving';
    attempt: LastWriteAttempt;
} | {
    kind: 'error';
    message: string;
    lastAttempt: LastWriteAttempt;
};
type SaveStatusState = {
    state: SaveState;
    /** A canvas edit landed but the debounced write hasn't fired yet. */
    markUnsaved: () => void;
    /** A write IPC is dispatching — record the attempt so we can retry on failure. */
    markSaving: (attempt: LastWriteAttempt) => void;
    /** Both IPC resolution and chokidar ack have arrived for the pending write. */
    markConfirmed: () => void;
    /** Write or patch failed — error stays visible until a later save succeeds. */
    markError: (message: string, attempt: LastWriteAttempt) => void;
    /**
     * Dedupe short-circuit: a canvas change produced no new code (identical to
     * the last write), so there's nothing to persist and we're already clean.
     * Only nudges `unsaved` → `saved`; other states are unaffected.
     */
    markClean: () => void;
};
/**
 * The save-status state machine lives in its own store so zundo's
 * temporal wrapper on `canvasSlice` doesn't capture these transitions
 * as undo steps, and so feature work can subscribe to save lifecycle
 * events without re-rendering on unrelated canvas changes.
 */
export declare const useSaveStatusStore: import("zustand").UseBoundStore<import("zustand").StoreApi<SaveStatusState>>;
export {};
