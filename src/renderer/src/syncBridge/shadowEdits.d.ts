/**
 * Phase 1 of docs/plans/incremental-writes-plan.md, in shadow.
 *
 * Every save still writes both files whole. Alongside it, this derives
 * the edits that save WOULD have written, checks that applying them to
 * the last-written text reproduces the generated text, and records how
 * much of each file the change actually touches.
 *
 * Two things come out of it. A divergence means the derivation is
 * wrong, and is logged loudly because later phases write from it. The
 * totals answer the question that decides whether phase 3 is worth
 * doing: how small are real changes, and how often is the whole file
 * genuinely the answer.
 *
 * Set `localStorage['scamp.debugWrites'] = '1'` to see a line per save.
 */
export type ShadowTotals = {
    /** Saves where a base was known, so edits could be derived. */
    saves: number;
    /** Times applying the edits didn't reproduce the generated text. A bug. */
    divergences: number;
    /** Lines the edits would have rewritten. */
    linesTouched: number;
    /** Lines the whole-file write rewrites instead. */
    linesWritten: number;
    /** Saves whose change was a single hunk in each file it touched. */
    singleHunkSaves: number;
};
/** The running totals for this session. Read from devtools or a test. */
export declare const shadowEditTotals: () => ShadowTotals;
export declare const resetShadowEditTotals: () => void;
export type ShadowFile = {
    /** `tsx` or `css`, for the log line. */
    label: string;
    /** What we believe is on disk. Null before the first save of a target. */
    base: string | null;
    /** What the whole-file write is about to put there. */
    next: string;
};
/**
 * Derive, verify, and measure. Never throws: this runs beside a real
 * save, and a flaw in the shadow path must not cost the user a write.
 */
export declare const reportShadowEdits: (targetName: string, files: ReadonlyArray<ShadowFile>) => void;
