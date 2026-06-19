/**
 * The "significant canvas change" snapshot trigger: while editing, take an
 * `auto_save` snapshot at most once every 2 minutes of canvas activity, so
 * the user has durable in-session restore points without one per action.
 * Finer per-edit granularity comes from the in-memory undo entries the
 * History panel interleaves between these snapshots — see
 * docs/notes/snapshots.md — so this interval stays coarse to limit disk
 * writes. Idle time contributes nothing (the check only runs on a real
 * element change).
 * Disabled when `enabled` is false (the project's `snapshotAutoSave`
 * config flag). Flushes the pending write first so the snapshot includes
 * the latest canvas state. See docs/notes/snapshots.md.
 */
export declare const useSnapshotAutoSave: (projectPath: string, enabled: boolean) => void;
