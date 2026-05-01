export declare const flushPendingPageWrite: () => void;
/**
 * Commit a CSS panel patch through the save-status pipeline. The
 * CssPanel previously called `window.scamp.patchFile` directly; routing
 * through here keeps the "Saving…" / "Saved" transitions consistent
 * between canvas-driven writes and panel edits.
 */
export declare const savePatch: (attempt: {
    cssPath: string;
    className: string;
    newDeclarations: string;
    media?: {
        maxWidth: number;
    };
}) => Promise<void>;
/**
 * Re-dispatch the last attempted save. Invoked by the error-state
 * retry button on the save-status indicator.
 */
export declare const retryLastSave: () => void;
/**
 * Wires the canvas store to the file system.
 *
 *   - On any canvas state change: regenerate code and write the page files
 *     after a 200ms debounce. The write is acked by the main process so
 *     chokidar won't re-read what we just wrote.
 *   - On `file:changed` for the active page: parse the new file content
 *     and reload the canvas — but only if the parsed tree differs from
 *     the current state, so external no-op changes don't cause flicker.
 *   - On `file:writeAck`: correlate against the pending-saves map and
 *     transition the save-status indicator to "Saved" once both IPC
 *     resolution and all expected path acks have landed.
 *   - When the canvas state is loaded from a parse result, the next
 *     subscribe tick refreshes a "last written" cache so the load doesn't
 *     immediately write itself back to disk.
 *
 * Pending-write durability:
 *   - When the active page changes, any pending debounced write is
 *     IMMEDIATELY flushed against the OUTGOING page's state before the
 *     timer is cleared. Without this, switching pages within 200ms of an
 *     edit would silently drop the edit because the timer would fire
 *     against the new page's state and write a no-op.
 *   - When the renderer is unloading (window close, full reload),
 *     `beforeunload` flushes any pending write the same way. The IPC
 *     message is queued for the main process to complete after the
 *     renderer is gone.
 */
export declare const initSyncBridge: () => (() => void);
