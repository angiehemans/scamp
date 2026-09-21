/**
 * Offsets that survive a rewrite.
 *
 * `parseCode` cannot hand its tokenizer the file as written: named-slot
 * props, braced attribute values, and the repeat and show wrappers all
 * have to be rewritten into something an HTML tokenizer can read. Every
 * offset the tokenizer then reports is an offset into that rewritten
 * text, which is why nothing downstream has ever been able to point at
 * a position in the real file.
 *
 * A source map is the list of regions a rewrite replaced, in both
 * coordinate systems. Everything outside those regions moved by a fixed
 * amount, so mapping back is exact; a position inside a replaced region
 * can only resolve to that region's own bounds, which is the honest
 * answer — the text it came from is gone.
 *
 * see docs/plans/incremental-writes-plan.md, phase 5
 */
/** A region of the rewritten text, and where it came from. */
export type Replaced = {
    start: number;
    end: number;
    origStart: number;
    origEnd: number;
};
export type SourceMap = {
    /** A start offset in the rewritten text, as an offset in the original. */
    toOriginalStart: (offset: number) => number;
    /** An end offset (exclusive) in the rewritten text, likewise. */
    toOriginalEnd: (offset: number) => number;
};
export declare const identityMap: () => SourceMap;
/**
 * Build a map from the regions a rewrite replaced. `replaced` must be
 * ascending and disjoint, which is how both hoisting passes already
 * collect their edits.
 */
export declare const sourceMapOf: (replaced: ReadonlyArray<Replaced>) => SourceMap;
/** One rewrite: replace `[start, end)` of the source with `text`. */
export type Rewrite = {
    start: number;
    end: number;
    text: string;
};
/**
 * Apply rewrites and report where everything went. Rewrites are sorted
 * here, so a caller that collected them by scanning backwards doesn't
 * have to care.
 */
export declare const applyRewrites: (source: string, rewrites: ReadonlyArray<Rewrite>) => {
    text: string;
    map: SourceMap;
};
/**
 * `first` maps a middle text back to the original; `second` maps the
 * final text back to that middle. The result maps the final text back
 * to the original, which is what a chain of rewrites needs.
 */
export declare const composeMaps: (first: SourceMap, second: SourceMap) => SourceMap;
