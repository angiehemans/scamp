import type { RecentProject } from './types';
/**
 * Coerce one raw JSON entry from `recentProjects.json` into a typed
 * `RecentProject`. Entries written before the `format` field existed
 * are backfilled with `legacy` — accurate for any project created
 * before that field was introduced. Entries missing the required
 * fields (`name`, `path`, `lastOpened`) are dropped.
 */
export declare const normalizeRecentProjectEntry: (raw: unknown) => RecentProject | null;
