import type { SnapshotMeta, SnapshotRestoreResult, SnapshotTrigger } from '@shared/types';
type SnapshotsState = {
    snapshots: SnapshotMeta[];
    /** Re-read the snapshot index from disk (via main). */
    loadSnapshots: (projectPath: string) => Promise<void>;
    /** Create a snapshot then refresh the list. */
    takeSnapshot: (projectPath: string, trigger: SnapshotTrigger, label?: string) => Promise<void>;
    /**
     * Restore a snapshot. On success the in-session undo stack is cleared
     * (you can't Cmd+Z back through a restore) and the list refreshes (a
     * `before_restore` snapshot was added). Main broadcasts
     * ProjectPagesChanged so the canvas/project re-reads from disk.
     */
    restoreSnapshot: (projectPath: string, snapshotId: string) => Promise<SnapshotRestoreResult>;
    deleteSnapshot: (projectPath: string, snapshotId: string) => Promise<void>;
};
export declare const useSnapshotsStore: import("zustand").UseBoundStore<import("zustand").StoreApi<SnapshotsState>>;
export {};
