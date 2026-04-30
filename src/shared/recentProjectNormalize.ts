import type { ProjectFormat, RecentProject } from './types';

const isProjectFormat = (v: unknown): v is ProjectFormat =>
  v === 'legacy' || v === 'nextjs';

/**
 * Coerce one raw JSON entry from `recentProjects.json` into a typed
 * `RecentProject`. Entries written before the `format` field existed
 * are backfilled with `legacy` — accurate for any project created
 * before that field was introduced. Entries missing the required
 * fields (`name`, `path`, `lastOpened`) are dropped.
 */
export const normalizeRecentProjectEntry = (
  raw: unknown
): RecentProject | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== 'string' || typeof r.path !== 'string') return null;
  if (typeof r.lastOpened !== 'string') return null;
  const format = isProjectFormat(r.format) ? r.format : 'legacy';
  return { name: r.name, path: r.path, format, lastOpened: r.lastOpened };
};
