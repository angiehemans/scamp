import type { ProjectFormat, SnapshotMeta, SnapshotTrigger } from '@shared/types';
/** Max snapshots kept locally; oldest is pruned when a new one exceeds it. */
export declare const SNAPSHOT_LIMIT = 50;
/** Consecutive external edits within this window collapse into one snapshot. */
export declare const AGENT_EDIT_COLLAPSE_MS = 5000;
/** A fresh, collision-resistant snapshot id (also the on-disk folder name). */
export declare const snapshotIdFor: () => string;
/**
 * Concise display label per trigger. Time isn't embedded — the panel
 * renders it from the snapshot's `timestamp`. `detail` carries the
 * changed filename (`agent_edit`) or the user-typed name (`manual`).
 */
export declare const formatTriggerLabel: (trigger: SnapshotTrigger, detail?: string) => string;
/**
 * True when an `agent_edit` snapshot should be skipped because the most
 * recent snapshot is also an `agent_edit` within the collapse window —
 * keeps a rapid agent burst from flooding the history.
 */
export declare const shouldCollapseAgentEdit: (snapshots: ReadonlyArray<SnapshotMeta>, trigger: SnapshotTrigger, nowMs: number, windowMs?: number) => boolean;
/**
 * Split a snapshot list into the newest `limit` to keep and the oldest to
 * remove. Pure — the caller deletes the removed folders + rewrites the
 * index. Pruning is purely by age, no trigger is exempt.
 */
export declare const pruneToLimit: (snapshots: ReadonlyArray<SnapshotMeta>, limit?: number) => {
    kept: SnapshotMeta[];
    removed: SnapshotMeta[];
};
/**
 * The absolute paths of every snapshot-relevant file: page `.tsx` +
 * `.module.css` (nextjs: `app/page.*` + `app/<page>/page.*`; legacy: root
 * `*.tsx` + `*.module.css`) plus `components/<Name>/<Name>.*`. A direct
 * byte walk — independent of `parseCode`, so even a malformed file an
 * agent just wrote is captured (the whole point of the safety net).
 */
export declare const enumerateProjectFiles: (projectPath: string, format: ProjectFormat) => Promise<string[]>;
/**
 * Snapshot the project's current on-disk state. Never throws — on any
 * failure (disk full, permissions) it logs and returns null so a failed
 * snapshot can't block the user. Returns null (no snapshot) when an
 * `agent_edit` is collapsed into a recent one. `nowMs` is injectable for
 * deterministic tests.
 */
export declare const createSnapshot: (projectPath: string, format: ProjectFormat, trigger: SnapshotTrigger, detail?: string, nowMs?: number) => Promise<SnapshotMeta | null>;
export declare const listSnapshots: (projectPath: string) => Promise<SnapshotMeta[]>;
export declare const deleteSnapshot: (projectPath: string, snapshotId: string) => Promise<{
    ok: boolean;
}>;
type RestoreOptions = {
    nowMs?: number;
    /**
     * Called with each destination path just before it's overwritten.
     * The IPC handler uses this to register a suppressed pending-write so
     * the watcher doesn't treat the restore's copies as external edits
     * (which would spawn `agent_edit` snapshots and a redundant reload).
     */
    beforeWrite?: (dest: string) => void;
};
/**
 * Restore a snapshot: first snapshot the current state (`before_restore`)
 * so the restore itself is undoable, then copy the snapshot's files back
 * over the project. Overlay copy — files added since the snapshot are
 * left in place.
 */
export declare const restoreSnapshot: (projectPath: string, format: ProjectFormat, snapshotId: string, opts?: RestoreOptions) => Promise<{
    ok: boolean;
    error?: string;
}>;
export {};
