/**
 * Tracks which project file paths are currently being processed by
 * the chokidar `onFileChanged` handler. While a path is "pending,"
 * the sync bridge's `writeIfDirty` bails on any canvas-side write
 * targeting that path — the renderer's `lastSerialized` is stale
 * until the chokidar handler finishes its reload.
 *
 * Phase 1 of the agent-coexistence work. Phase 3 will extend this
 * with a time-based quiet window so protection survives past the
 * synchronous handler execution; the API here is shaped to accept
 * that extension without changing call sites.
 *
 * Module is pure and testable in isolation — no Zustand, no IPC.
 * The bridge instantiates one shared instance via the default
 * export at module load.
 */
export type ExternalEditTracker = {
    /** Mark a path as being externally edited. Idempotent. */
    mark: (path: string) => void;
    /**
     * Mark two sibling paths (typical tsx + css pair) at once. Small
     * convenience so call sites can stay one-line.
     */
    markPair: (tsxPath: string, cssPath: string) => void;
    /** Clear a previously marked path. No-op if not marked. */
    clear: (path: string) => void;
    /** Clear a sibling pair. */
    clearPair: (tsxPath: string, cssPath: string) => void;
    /**
     * True if either of the given sibling paths is currently marked.
     * The sync bridge uses this gate before dispatching a write.
     */
    isPending: (tsxPath: string, cssPath: string) => boolean;
    /** Internal — exposed for tests; do not rely on the iteration order. */
    snapshot: () => ReadonlySet<string>;
};
export declare const createExternalEditTracker: () => ExternalEditTracker;
/** Shared instance used by the sync bridge. */
export declare const externalEditTracker: ExternalEditTracker;
