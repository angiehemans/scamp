/**
 * "Last opened" on the start screen wants a much coarser scale than the
 * history panel's `formatRelativeTime`, which is tuned for undo steps
 * seconds apart and degrades to a bare `HH:MM` past 24 hours — so a
 * project opened last week reads as "14:32" with no date at all.
 *
 * The ladder, each step the point where the one below stops being
 * readable at a glance:
 *
 *   < 1 min    → "Just now"
 *   < 1 hour   → "N minutes ago"
 *   < 1 day    → "N hours ago"
 *   < 1 week   → "N days ago"
 *   < ~1 month → "N weeks ago"
 *   < 1 year   → "N months ago"
 *   < 5 years  → "N years ago"
 *   otherwise  → an absolute date, "12 Mar 2019"
 */
/**
 * Formats a "last opened" timestamp relative to `now`.
 *
 * Future timestamps read as "Just now" rather than a negative count —
 * a clock that disagrees with the file's mtime should not surface as
 * "-3 minutes ago". A non-finite timestamp gives "Unknown".
 */
export declare const formatLastOpened: (ts: number, now: number) => string;
