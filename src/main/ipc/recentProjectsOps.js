import { normalizeRecentProjectEntry } from '@shared/recentProjectNormalize';
// The Start Screen now lists every project in the default folder, so the
// recents store's job is narrower: carry open timestamps for ordering and
// remember projects opened from outside the default folder. Keep a
// generous cap so recency ordering survives for realistic project counts.
export const MAX_RECENT = 30;
/**
 * Parse the on-disk store blob into a clean `RecentProject[]`. Tolerant
 * of any structural surprise (missing key, non-array, malformed
 * entries) — returns `[]` rather than throwing. JSON.parse may throw on
 * malformed input; the handler's try/catch owns that.
 */
export const parseRecentStore = (raw) => {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'recentProjects' in parsed) {
        const list = parsed.recentProjects;
        if (Array.isArray(list)) {
            return list
                .map(normalizeRecentProjectEntry)
                .filter((e) => e !== null);
        }
    }
    return [];
};
/** Move/insert an entry at the front, deduped by path, capped at `max`. */
export const upsertRecent = (list, entry, max = MAX_RECENT) => [entry, ...list.filter((p) => p.path !== entry.path)].slice(0, max);
/** Update the format of the entry at `path` in place. */
export const setRecentFormat = (list, path, format) => list.map((p) => (p.path === path ? { ...p, format } : p));
/** Drop the entry at `path`. */
export const removeRecentByPath = (list, path) => list.filter((p) => p.path !== path);
