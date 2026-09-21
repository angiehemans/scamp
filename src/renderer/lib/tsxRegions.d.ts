import type { TextEdit } from './textEdits';
/**
 * The regions of a view or component file that Scamp owns, and the
 * edits that bring one file's owned regions in line with another's.
 *
 * Phase 3 of docs/plans/incremental-writes-plan.md, and the same idea
 * as the CSS rule slots in `cssRuleEdits.ts`: address the parts the
 * generator is responsible for, rewrite only those, and leave the rest
 * of the file exactly as it was.
 *
 * What that saves is everything a whole-file write currently destroys
 * in a file Scamp did not write: an import the generator has no
 * opinion about, a module-level constant, a comment above the
 * component, an export beside the default one. Measured before this
 * existed, all four were silently dropped by the first canvas edit.
 *
 * The component function itself IS owned, so a hook call inside it is
 * still lost. That matches the contract — a view is a plain function of
 * its props — and moving that line would mean parsing the function
 * body rather than finding it.
 */
export type TsxRegionKind = 'stylesImport' | 'componentImport' | 'propsType' | 'component' | 'scampMeta';
export type TsxRegion = {
    kind: TsxRegionKind;
    /** Distinguishes regions of the same kind. The component name, for an import. */
    key: string;
    /** Offsets into the source, `[start, end)`, covering whole lines. */
    start: number;
    end: number;
    text: string;
};
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
export declare const findTsxRegions: (source: string) => TsxRegion[];
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
export declare const tsxRegionChanges: (base: string, next: string) => TextEdit[];
/**
 * The edits a save should write for a view file: the owned regions
 * where they differ, and within a region that is only partly different,
 * the lines that actually changed.
 *
 * The second step is what keeps a steady-state save minimal. A text
 * edit changes one line of the component region, not the whole
 * function, because the region's replacement is itself diffed.
 */
export declare const narrowEdit: (base: string, edit: TextEdit) => TextEdit[];
export declare const tsxEdits: (base: string, next: string) => TextEdit[];
