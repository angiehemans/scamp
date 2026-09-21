import { diffText } from './textEdits';
const STYLES_IMPORT = /^import\s+styles\s+from\s+['"][^'"]+['"];?\s*$/;
const COMPONENT_IMPORT = /^import\s+(\w+)\s+from\s+['"]@\/components\/(\w+)\/\2['"];?\s*$/;
const PROPS_TYPE_OPEN = /^type\s+(\w+Props)\s*=\s*\{\s*$/;
const BLOCK_CLOSE = /^\};?\s*$/;
const COMPONENT_OPEN = /^export\s+default\s+function\s+(\w+)\s*\(/;
const COMPONENT_CLOSE = /^\}\s*$/;
const SCAMP_META = /^export\s+const\s+_scamp\s*=.*as\s+const\s*;?\s*$/;
const regionKey = (region) => `${region.kind}:${region.key}`;
/**
 * Locate the owned regions, in source order. Anything not covered by
 * one is the file's own and is never touched.
 *
 * Line-based on purpose. The parser rewrites the source before it reads
 * it — bindings and slots are hoisted, wrappers become pseudo-tags — so
 * positions from the parse don't point at the file. Finding a handful
 * of structural landmarks in the raw text does, and needs nothing from
 * the parser.
 */
export const findTsxRegions = (source) => {
    const lines = source.split(/(?<=\n)/);
    const offsets = [];
    let at = 0;
    for (const line of lines) {
        offsets.push(at);
        at += line.length;
    }
    const startOf = (i) => offsets[i] ?? at;
    const endOf = (i) => (i + 1 < offsets.length ? (offsets[i + 1] ?? at) : at);
    const regions = [];
    const push = (kind, key, from, to) => {
        const start = startOf(from);
        const end = endOf(to);
        regions.push({ kind, key, start, end, text: source.slice(start, end) });
    };
    for (let i = 0; i < lines.length; i += 1) {
        const line = (lines[i] ?? '').replace(/\r?\n$/, '');
        if (STYLES_IMPORT.test(line)) {
            push('stylesImport', '', i, i);
            continue;
        }
        const component = COMPONENT_IMPORT.exec(line);
        if (component?.[2] !== undefined) {
            push('componentImport', component[2], i, i);
            continue;
        }
        const props = PROPS_TYPE_OPEN.exec(line);
        if (props?.[1] !== undefined) {
            let end = i;
            while (end < lines.length && !BLOCK_CLOSE.test((lines[end] ?? '').replace(/\r?\n$/, ''))) {
                end += 1;
            }
            if (end < lines.length) {
                push('propsType', props[1], i, end);
                i = end;
            }
            continue;
        }
        const fn = COMPONENT_OPEN.exec(line);
        if (fn?.[1] !== undefined) {
            let end = i + 1;
            while (end < lines.length && !COMPONENT_CLOSE.test((lines[end] ?? '').replace(/\r?\n$/, ''))) {
                end += 1;
            }
            if (end < lines.length) {
                push('component', fn[1], i, end);
                i = end;
            }
            continue;
        }
        if (SCAMP_META.test(line))
            push('scampMeta', '', i, i);
    }
    return regions;
};
/**
 * Edits that make `base`'s owned regions say what `next`'s do, leaving
 * every other byte of `base` alone. Ascending and non-overlapping, so
 * `applyEdits` accepts them.
 *
 * A region in both whose text already matches produces nothing. A
 * region only in `next` is inserted beside whichever of its neighbours
 * `base` already has. A region only in `base` is removed, because the
 * kinds here are all ones the generator emits — an import of a
 * component no longer used has to go.
 */
export const tsxRegionChanges = (base, next) => {
    const baseRegions = findTsxRegions(base);
    const nextRegions = findTsxRegions(next);
    const baseByKey = new Map(baseRegions.map((r) => [regionKey(r), r]));
    const nextKeys = new Set(nextRegions.map((r) => regionKey(r)));
    const order = nextRegions.map((r) => regionKey(r));
    const edits = [];
    for (const region of baseRegions) {
        if (!nextKeys.has(regionKey(region))) {
            edits.push({ start: region.start, end: region.end, replacement: '' });
        }
    }
    for (const [index, region] of nextRegions.entries()) {
        const existing = baseByKey.get(regionKey(region));
        if (existing !== undefined) {
            if (existing.text !== region.text) {
                edits.push({ start: existing.start, end: existing.end, replacement: region.text });
            }
            continue;
        }
        // New region: sit it beside a neighbour the file already has.
        let at = null;
        for (let i = index - 1; i >= 0 && at === null; i -= 1) {
            const before = baseByKey.get(order[i] ?? '');
            if (before !== undefined)
                at = before.end;
        }
        for (let i = index + 1; i < order.length && at === null; i += 1) {
            const after = baseByKey.get(order[i] ?? '');
            if (after !== undefined)
                at = after.start;
        }
        edits.push({ start: at ?? base.length, end: at ?? base.length, replacement: region.text });
    }
    // `applyEdits` requires ascending, non-overlapping edits. Two
    // insertions can share an offset; order is then arbitrary but stable.
    return edits.sort((a, b) => a.start - b.start || a.end - b.end);
};
/**
 * The edits a save should write for a view file: the owned regions
 * where they differ, and within a region that is only partly different,
 * the lines that actually changed.
 *
 * The second step is what keeps a steady-state save minimal. A text
 * edit changes one line of the component region, not the whole
 * function, because the region's replacement is itself diffed.
 */
export const tsxEdits = (base, next) => tsxRegionChanges(base, next).flatMap((edit) => {
    if (edit.start === edit.end || edit.replacement.length === 0)
        return [edit];
    const inner = diffText(base.slice(edit.start, edit.end), edit.replacement);
    return inner.map((hunk) => ({
        start: edit.start + hunk.start,
        end: edit.start + hunk.end,
        replacement: hunk.replacement,
    }));
});
