/**
 * @param send          How to deliver an ack to the renderer.
 * @param expiryMs      If chokidar never fires for a registered path,
 *                      the ack is emitted anyway after this delay so
 *                      the indicator unwinds.
 */
export const createPendingWriteTracker = (send, expiryMs) => {
    const pending = new Map();
    const register = (path, writeId, suppressChanged) => {
        const existing = pending.get(path);
        if (existing) {
            // Two writes to the same path in quick succession (e.g. the
            // syncBridge's debounced flush followed by an explicit
            // rewrite during a component rename). The second write
            // supersedes the first ON DISK — chokidar will only fire
            // once for the final state — so we ack the previous writeId
            // here. Without this, the renderer's tracker for the
            // overwritten writeId waits for an ack that never arrives,
            // its 2s watchdog fires, and the save-status indicator
            // surfaces a false-positive "Save failed" even though the
            // user's content landed correctly.
            clearTimeout(existing.timer);
            send({ writeId: existing.writeId, path });
        }
        const timer = setTimeout(() => {
            const entry = pending.get(path);
            pending.delete(path);
            if (!entry)
                return;
            send({ writeId: entry.writeId, path });
        }, expiryMs);
        pending.set(path, { writeId, suppressChanged, timer });
    };
    const cancel = (path) => {
        const existing = pending.get(path);
        if (!existing)
            return;
        clearTimeout(existing.timer);
        pending.delete(path);
    };
    const consume = (path) => {
        const entry = pending.get(path);
        if (!entry)
            return null;
        clearTimeout(entry.timer);
        pending.delete(path);
        send({ writeId: entry.writeId, path });
        return { suppressChanged: entry.suppressChanged };
    };
    return {
        register,
        cancel,
        consume,
        size: () => pending.size,
    };
};
