export const triggerIcon = (trigger) => {
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
export const snapshotsNewestFirst = (snapshots) => [...snapshots].reverse();
/** `pageCount` → "2 pages" / "1 page". */
export const formatPageCount = (count) => `${count} ${count === 1 ? 'page' : 'pages'}`;
