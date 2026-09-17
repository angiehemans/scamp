/**
 * Text edits: the unit a save will eventually write, instead of a whole
 * file. An edit replaces one region of a base text, addressed by
 * character offsets so the representation survives being sent somewhere
 * else (an agent, another client) rather than only being applied here.
 *
 * Phase 1 of docs/plans/incremental-writes-plan.md uses these in shadow:
 * the save still writes both files whole, and the edits derived
 * alongside it are checked and measured. Nothing here performs IO, and
 * nothing here knows what TSX or CSS are — a hunk is a hunk.
 */
/** A replacement of `base.slice(start, end)`. */
export type TextEdit = {
    /** Offset into the base text, inclusive. */
    start: number;
    /** Offset into the base text, exclusive. `start === end` inserts. */
    end: number;
    /** Replaces the addressed region. Empty deletes it. */
    replacement: string;
};
export type EditStats = {
    /** Disjoint regions the change touches. One is the goal for one design change. */
    hunks: number;
    /** Lines of the base the edits cover. */
    linesRemoved: number;
    /** Lines the replacements introduce. */
    linesAdded: number;
    /** Lines in the base, for scale. */
    baseLines: number;
};
/**
 * The edits that turn `base` into `next`, one per changed region, in
 * ascending order and never overlapping. Equal texts produce none.
 *
 * Line-granular on purpose: a line is the smallest unit both a
 * generated file and a person's diff agree on, and a sub-line edit
 * would claim a precision the generator doesn't have.
 */
export declare const diffText: (base: string, next: string) => TextEdit[];
/**
 * Apply edits to the text they were derived from. Strict: the edits
 * must be in ascending order, must not overlap, and must sit inside the
 * text. A violation is a bug in whatever produced them, and the merge
 * this becomes in a later phase has to be able to trust the shape.
 */
export declare const applyEdits: (base: string, edits: ReadonlyArray<TextEdit>) => string;
/** How surgical a change is, for the shadow report. */
export declare const editStats: (base: string, edits: ReadonlyArray<TextEdit>) => EditStats;
