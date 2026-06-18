/**
 * Wire up the project-snapshot IPC channels. Every handler resolves the
 * project format from the cached lookup before delegating, mirroring the
 * page / component handlers. All `.scamp/` file I/O lives in snapshotOps.
 *
 * Restore registers a suppressed pending-write for every file it copies
 * back, so the watcher treats the burst as Scamp's own writes (no
 * `agent_edit` snapshot, no per-file reload), then broadcasts
 * ProjectPagesChanged so the renderer re-reads the whole project from
 * disk through the existing refresh path. The renderer additionally
 * clears the in-session undo stack on a successful restore.
 */
export declare const registerSnapshotIpc: () => void;
