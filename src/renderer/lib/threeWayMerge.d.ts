export type MergeResult = {
    ok: true;
    text: string;
    /** Edits contributed by each side, for the log line and the tests. */
    fromOurs: number;
    fromTheirs: number;
} | {
    ok: false;
    /** The base regions the two sides disagree about. */
    overlaps: Array<{
        start: number;
        end: number;
    }>;
};
/**
 * Merge `ours` and `theirs`, both derived from `base`. Either side
 * having made no change yields the other verbatim, and the two sides
 * having made the same change is not a conflict.
 */
export declare const mergeText: (base: string, ours: string, theirs: string) => MergeResult;
