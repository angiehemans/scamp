import { normalizeRecentProjectEntry } from '@shared/recentProjectNormalize';
import type { ProjectFormat, RecentProject } from '@shared/types';

export const MAX_RECENT = 5;

/**
 * Parse the on-disk store blob into a clean `RecentProject[]`. Tolerant
 * of any structural surprise (missing key, non-array, malformed
 * entries) — returns `[]` rather than throwing. JSON.parse may throw on
 * malformed input; the handler's try/catch owns that.
 */
export const parseRecentStore = (raw: string): RecentProject[] => {
  const parsed: unknown = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && 'recentProjects' in parsed) {
    const list = (parsed as { recentProjects: unknown }).recentProjects;
    if (Array.isArray(list)) {
      return list
        .map(normalizeRecentProjectEntry)
        .filter((e): e is RecentProject => e !== null);
    }
  }
  return [];
};

/** Move/insert an entry at the front, deduped by path, capped at `max`. */
export const upsertRecent = (
  list: ReadonlyArray<RecentProject>,
  entry: RecentProject,
  max: number = MAX_RECENT
): RecentProject[] =>
  [entry, ...list.filter((p) => p.path !== entry.path)].slice(0, max);

/** Update the format of the entry at `path` in place. */
export const setRecentFormat = (
  list: ReadonlyArray<RecentProject>,
  path: string,
  format: ProjectFormat
): RecentProject[] =>
  list.map((p) => (p.path === path ? { ...p, format } : p));

/** Drop the entry at `path`. */
export const removeRecentByPath = (
  list: ReadonlyArray<RecentProject>,
  path: string
): RecentProject[] => list.filter((p) => p.path !== path);
