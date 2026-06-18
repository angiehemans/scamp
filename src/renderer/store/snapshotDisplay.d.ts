import type { SnapshotMeta, SnapshotTrigger } from '@shared/types';
/** The icon family a trigger maps to in the panel. */
export type TriggerIcon = 'session-open' | 'session-close' | 'agent' | 'manual' | 'auto' | 'restore';
export declare const triggerIcon: (trigger: SnapshotTrigger) => TriggerIcon;
/**
 * Snapshots are stored oldest-first in `snapshots.json`; the panel shows
 * newest at the top. Returns a new array (doesn't mutate).
 */
export declare const snapshotsNewestFirst: (snapshots: ReadonlyArray<SnapshotMeta>) => SnapshotMeta[];
/** `pageCount` → "2 pages" / "1 page". */
export declare const formatPageCount: (count: number) => string;
