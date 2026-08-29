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

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Past this, a year count stops carrying meaning and a date is clearer. */
const MAX_RELATIVE_DAYS = 5 * 365;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Built by hand rather than `toLocaleDateString`, whose output shifts
    with the host's ICU locale and would make this untestable. */
const absoluteDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()] ?? ''} ${d.getFullYear()}`;
};

const plural = (count: number, unit: string): string =>
  `${count} ${unit}${count === 1 ? '' : 's'} ago`;

/**
 * Formats a "last opened" timestamp relative to `now`.
 *
 * Future timestamps read as "Just now" rather than a negative count —
 * a clock that disagrees with the file's mtime should not surface as
 * "-3 minutes ago". A non-finite timestamp gives "Unknown".
 */
export const formatLastOpened = (ts: number, now: number): string => {
  if (!Number.isFinite(ts)) return 'Unknown';

  const ms = now - ts;
  if (ms < MINUTE) return 'Just now';
  if (ms < HOUR) return plural(Math.floor(ms / MINUTE), 'minute');
  if (ms < DAY) return plural(Math.floor(ms / HOUR), 'hour');

  const days = Math.floor(ms / DAY);
  if (days < 7) return plural(days, 'day');
  // Clamped so the boundaries never read "0 weeks" or roll past the next
  // unit ("12 months ago" at 364 days).
  if (days < 30) return plural(Math.max(1, Math.floor(days / 7)), 'week');
  if (days < 365) {
    return plural(Math.min(11, Math.max(1, Math.floor(days / 30))), 'month');
  }
  if (days < MAX_RELATIVE_DAYS) {
    return plural(Math.max(1, Math.floor(days / 365)), 'year');
  }
  return absoluteDate(ts);
};
