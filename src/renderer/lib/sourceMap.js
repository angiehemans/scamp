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
export const identityMap = () => ({
    toOriginalStart: (offset) => offset,
    toOriginalEnd: (offset) => offset,
});
/**
 * Build a map from the regions a rewrite replaced. `replaced` must be
 * ascending and disjoint, which is how both hoisting passes already
 * collect their edits.
 */
export const sourceMapOf = (replaced) => {
    if (replaced.length === 0)
        return identityMap();
    const at = (offset, edge) => {
        let delta = 0;
        for (const region of replaced) {
            if (offset < region.start)
                break;
            if (offset < region.end) {
                return edge === 'start' ? region.origStart : region.origEnd;
            }
            // An offset exactly at a region's end sits after it.
            delta += region.end - region.start - (region.origEnd - region.origStart);
        }
        return offset - delta;
    };
    return {
        toOriginalStart: (offset) => at(offset, 'start'),
        toOriginalEnd: (offset) => at(offset, 'end'),
    };
};
/**
 * Apply rewrites and report where everything went. Rewrites are sorted
 * here, so a caller that collected them by scanning backwards doesn't
 * have to care.
 */
export const applyRewrites = (source, rewrites) => {
    if (rewrites.length === 0)
        return { text: source, map: identityMap() };
    const ordered = [...rewrites].sort((a, b) => a.start - b.start);
    const replaced = [];
    let out = '';
    let cursor = 0;
    for (const rewrite of ordered) {
        if (rewrite.start < cursor)
            continue; // overlapping; the first wins
        out += source.slice(cursor, rewrite.start);
        replaced.push({
            start: out.length,
            end: out.length + rewrite.text.length,
            origStart: rewrite.start,
            origEnd: rewrite.end,
        });
        out += rewrite.text;
        cursor = rewrite.end;
    }
    return { text: out + source.slice(cursor), map: sourceMapOf(replaced) };
};
/**
 * `first` maps a middle text back to the original; `second` maps the
 * final text back to that middle. The result maps the final text back
 * to the original, which is what a chain of rewrites needs.
 */
export const composeMaps = (first, second) => ({
    toOriginalStart: (offset) => first.toOriginalStart(second.toOriginalStart(offset)),
    toOriginalEnd: (offset) => first.toOriginalEnd(second.toOriginalEnd(offset)),
});
