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
export const createExternalEditTracker = () => {
    const pending = new Set();
    return {
        mark: (path) => {
            pending.add(path);
        },
        markPair: (tsxPath, cssPath) => {
            pending.add(tsxPath);
            pending.add(cssPath);
        },
        clear: (path) => {
            pending.delete(path);
        },
        clearPair: (tsxPath, cssPath) => {
            pending.delete(tsxPath);
            pending.delete(cssPath);
        },
        isPending: (tsxPath, cssPath) => pending.has(tsxPath) || pending.has(cssPath),
        snapshot: () => pending,
    };
};
/** Shared instance used by the sync bridge. */
export const externalEditTracker = createExternalEditTracker();
