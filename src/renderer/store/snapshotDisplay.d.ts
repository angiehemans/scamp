import type { SnapshotMeta, SnapshotTrigger } from '@shared/types';
import type { HistoryEntry } from './historyTypes';
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
/**
 * One row in the merged History panel: either a durable on-disk snapshot
 * or an in-session undo entry. `ts` is normalised to epoch ms for sorting
 * (snapshots store ISO strings, undo entries store ms). Undo rows carry
 * the entry's index in the active page's stack (for `jumpToHistory`) plus
 * its position relative to the cursor.
 */
export type TimelineItem = {
    readonly kind: 'snapshot';
    readonly ts: number;
    readonly snapshot: SnapshotMeta;
} | {
    readonly kind: 'undo';
    readonly ts: number;
    /** Index in the active page's `entries`; passed to `jumpToHistory`. */
    readonly index: number;
    readonly entry: HistoryEntry;
    /** The cursor is at this entry — the canvas is showing it now. */
    readonly isCurrent: boolean;
    /** Past the cursor — a redoable ("future") step. */
    readonly isFuture: boolean;
};
/**
 * Build the unified History timeline: durable on-disk snapshots interleaved
 * with the active page's in-memory undo entries, newest first. The undo
 * entries give per-edit granularity between the coarser snapshots without
 * extra disk writes. The synthetic `load` baseline entry is omitted (it's
 * not a user action). `cursor` is the undo entry the canvas is currently at
 * (`-1` = none); entries past it are redoable. See docs/notes/snapshots.md.
 */
export declare const mergeHistoryTimeline: (snapshots: ReadonlyArray<SnapshotMeta>, undoEntries: ReadonlyArray<HistoryEntry>, cursor: number) => TimelineItem[];
