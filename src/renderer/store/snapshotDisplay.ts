// Pure display helpers for the snapshot history panel. Kept separate from
// the slice (which touches window.scamp) so they're trivially unit-tested.
import type { SnapshotMeta, SnapshotTrigger } from '@shared/types';

/** The icon family a trigger maps to in the panel. */
export type TriggerIcon =
  | 'session-open'
  | 'session-close'
  | 'agent'
  | 'manual'
  | 'auto'
  | 'restore';

export const triggerIcon = (trigger: SnapshotTrigger): TriggerIcon => {
  switch (trigger) {
    case 'session_open':
      return 'session-open';
    case 'session_close':
      return 'session-close';
    case 'agent_edit':
      return 'agent';
    case 'manual':
      return 'manual';
    case 'auto_save':
      return 'auto';
    case 'before_restore':
      return 'restore';
  }
};

/**
 * Snapshots are stored oldest-first in `snapshots.json`; the panel shows
 * newest at the top. Returns a new array (doesn't mutate).
 */
export const snapshotsNewestFirst = (
  snapshots: ReadonlyArray<SnapshotMeta>
): SnapshotMeta[] => [...snapshots].reverse();

/** `pageCount` → "2 pages" / "1 page". */
export const formatPageCount = (count: number): string =>
  `${count} ${count === 1 ? 'page' : 'pages'}`;
