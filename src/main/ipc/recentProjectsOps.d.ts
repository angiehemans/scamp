import type { ProjectFormat, RecentProject } from '@shared/types';
export declare const MAX_RECENT = 30;
/**
 * Parse the on-disk store blob into a clean `RecentProject[]`. Tolerant
 * of any structural surprise (missing key, non-array, malformed
 * entries) — returns `[]` rather than throwing. JSON.parse may throw on
 * malformed input; the handler's try/catch owns that.
 */
export declare const parseRecentStore: (raw: string) => RecentProject[];
/** Move/insert an entry at the front, deduped by path, capped at `max`. */
export declare const upsertRecent: (list: ReadonlyArray<RecentProject>, entry: RecentProject, max?: number) => RecentProject[];
/** Update the format of the entry at `path` in place. */
export declare const setRecentFormat: (list: ReadonlyArray<RecentProject>, path: string, format: ProjectFormat) => RecentProject[];
/** Drop the entry at `path`. */
export declare const removeRecentByPath: (list: ReadonlyArray<RecentProject>, path: string) => RecentProject[];
