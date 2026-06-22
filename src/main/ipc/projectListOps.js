/**
 * Sort projects for the Start Screen: most-recently-opened first, then
 * projects that have never been opened (no timestamp) alphabetically by
 * name. ISO-8601 timestamps from the recents store sort correctly with
 * a plain string compare (fixed-width, UTC).
 */
const compareForDisplay = (a, b) => {
    if (a.lastOpened && b.lastOpened)
        return b.lastOpened.localeCompare(a.lastOpened);
    if (a.lastOpened)
        return -1;
    if (b.lastOpened)
        return 1;
    return a.name.localeCompare(b.name);
};
/**
 * Merge the recent-opens store with a scan of the default projects
 * folder into the deduped, sorted list shown on the Start Screen.
 *
 * Scanned projects seed the list (all exist, no open history). Recents
 * overlay their `lastOpened` timestamp onto matching scanned entries and
 * contribute any projects outside the default folder (or since deleted)
 * that the scan didn't surface. Deduped by path.
 *
 * Pure — no disk access; existence is resolved by the caller and passed
 * in via `recents`.
 */
export const mergeProjectsForDisplay = (recents, scanned) => {
    const byPath = new Map();
    for (const project of scanned) {
        byPath.set(project.path, {
            name: project.name,
            path: project.path,
            format: project.format,
            lastOpened: null,
            exists: true,
        });
    }
    for (const recent of recents) {
        const existing = byPath.get(recent.path);
        if (existing) {
            existing.lastOpened = recent.lastOpened;
        }
        else {
            byPath.set(recent.path, {
                name: recent.name,
                path: recent.path,
                format: recent.format,
                lastOpened: recent.lastOpened,
                exists: recent.exists,
            });
        }
    }
    return [...byPath.values()].sort(compareForDisplay);
};
