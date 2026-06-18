/**
 * The "significant canvas change" snapshot trigger: while editing, take an
 * `auto_save` snapshot at most once every 5 minutes of canvas activity, so
 * the user has in-session restore points without one per action. Idle time
 * contributes nothing (the check only runs on a real element change).
 * Disabled when `enabled` is false (the project's `snapshotAutoSave`
 * config flag). Flushes the pending write first so the snapshot includes
 * the latest canvas state. See docs/notes/snapshots.md.
 */
export declare const useSnapshotAutoSave: (projectPath: string, enabled: boolean) => void;
