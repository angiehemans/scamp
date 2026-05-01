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
        if (existing)
            clearTimeout(existing.timer);
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
