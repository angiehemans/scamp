/**
 * Wire up the project-snapshot IPC channels. Every handler resolves the
 * project format from the cached lookup before delegating, mirroring the
 * page / component handlers. All `.scamp/` file I/O lives in snapshotOps.
 *
 * The restore's main → renderer `SnapshotRestoreComplete` broadcast is
 * added in Phase E alongside the reload orchestration; for now restore is
 * a plain invoke that returns once the files are copied back.
 */
export declare const registerSnapshotIpc: () => void;
