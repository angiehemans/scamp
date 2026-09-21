/**
 * Three-way merge over the edits of phase 1.
 *
 * A save carries the version it believed was on disk, and main refuses
 * the write when disk says otherwise. Until now that refusal cost the
 * user their in-flight edit: Scamp adopted the disk version and dropped
 * the design change. Most of those refusals are not disagreements —
 * an agent rewriting a route's `load()` and a designer resizing a box
 * touch different lines of the same file.
 *
 * So: diff both sides against the base they share, and if the two sets
 * of edits do not overlap, apply both. A conflict is then only a real
 * overlap. see docs/plans/incremental-writes-plan.md, phase 4
 */
import { applyEdits, diffText } from './textEdits';
const sameEdit = (a, b) => a.start === b.start && a.end === b.end && a.replacement === b.replacement;
/**
 * Whether two edits of the same base collide.
 *
 * Ranges are half-open, so an edit that ends where the next begins is
 * adjacent, not overlapping — line-granular diffs produce that
 * constantly and it is never ambiguous. Two insertions at the same
 * point are the one exception: nothing says which goes first, so
 * unless they insert the same text they count as a collision.
 */
const collides = (a, b) => {
    if (a.start === a.end && b.start === b.end && a.start === b.start) {
        return a.replacement !== b.replacement;
    }
    return a.start < b.end && b.start < a.end;
};
/**
 * Merge `ours` and `theirs`, both derived from `base`. Either side
 * having made no change yields the other verbatim, and the two sides
 * having made the same change is not a conflict.
 */
export const mergeText = (base, ours, theirs) => {
    if (ours === theirs)
        return { ok: true, text: ours, fromOurs: 0, fromTheirs: 0 };
    if (base === theirs)
        return { ok: true, text: ours, fromOurs: 0, fromTheirs: 0 };
    if (base === ours)
        return { ok: true, text: theirs, fromOurs: 0, fromTheirs: 0 };
    const oursEdits = diffText(base, ours);
    const theirsEdits = diffText(base, theirs);
    const overlaps = [];
    const shared = [];
    for (const mine of oursEdits) {
        for (const yours of theirsEdits) {
            if (sameEdit(mine, yours)) {
                shared.push(mine);
                continue;
            }
            if (collides(mine, yours)) {
                overlaps.push({
                    start: Math.min(mine.start, yours.start),
                    end: Math.max(mine.end, yours.end),
                });
            }
        }
    }
    if (overlaps.length > 0)
        return { ok: false, overlaps };
    // Both sides making the same edit contributes it once.
    const theirsOnly = theirsEdits.filter((e) => !shared.some((s) => sameEdit(s, e)));
    const all = [...oursEdits, ...theirsOnly].sort((a, b) => a.start - b.start || a.end - b.end);
    return {
        ok: true,
        text: applyEdits(base, all),
        fromOurs: oursEdits.length,
        fromTheirs: theirsOnly.length,
    };
};
