import { detectProjectFormat } from './projectFormat';
/**
 * Main-side cache of `<projectPath> → ProjectFormat`. Populated on
 * `project:open` / `project:create` (and on the post-migration reload
 * in Phase 6) so handlers like `theme:read`, `page:create`, and
 * `file:copyImage` can decide which file paths to use without
 * threading the format through every IPC payload.
 *
 * Falls back to `detectProjectFormat` on a miss — the cache is an
 * optimisation, not a source of truth, so a miss never breaks
 * correctness. A user who hand-converts a project on disk (no
 * migrator) will be re-detected on the next `project:open`.
 */
const cache = new Map();
export const setCachedProjectFormat = (projectPath, format) => {
    cache.set(projectPath, format);
};
export const clearCachedProjectFormat = (projectPath) => {
    cache.delete(projectPath);
};
/**
 * Look up the cached format for a project; if not cached, run
 * `detectProjectFormat` against disk and cache the result. Always
 * resolves to a concrete format — never throws.
 */
export const getProjectFormat = async (projectPath) => {
    const cached = cache.get(projectPath);
    if (cached)
        return cached;
    const detected = await detectProjectFormat(projectPath);
    cache.set(projectPath, detected);
    return detected;
};
