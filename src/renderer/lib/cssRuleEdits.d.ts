/**
 * Rule-level changes between two stylesheets, and how to apply them to
 * a third.
 *
 * Phase 2 of docs/plans/incremental-writes-plan.md. A save compares the
 * stylesheet it is about to generate with the one on disk, and rewrites
 * only the rules whose declarations actually differ. Everything the
 * disk file holds outside those rules — comments, rule order, a
 * person's or an agent's formatting, at-rules Scamp doesn't model —
 * stays exactly as it was, because nothing goes near it.
 *
 * That matters most the first time a project is opened. The stylesheet
 * on disk was not necessarily written by Scamp, and until now the first
 * canvas edit reformatted all of it.
 *
 * Pure: no IO. postcss is already a dependency, and `shared/patchClass.ts`
 * has used it for the CSS panel's single-rule patch since before this.
 */
/** Where a change lands. The three shapes the generator emits. */
export type CssSlot = {
    kind: 'rule';
    selector: string;
} | {
    kind: 'ruleInMedia';
    media: string;
    selector: string;
}
/** A whole at-rule compared as one unit: `@keyframes`, and anything unmodelled. */
 | {
    kind: 'atRule';
    key: string;
};
export type CssChange = {
    op: 'set';
    slot: CssSlot;
    body: string;
} | {
    op: 'remove';
    slot: CssSlot;
};
type SlotEntry = {
    slot: CssSlot;
    /** The declarations as written, for writing back. */
    body: string;
    /** The declarations as meant, one per node, for comparing. */
    canonical: string[];
};
/**
 * Every addressable slot in a stylesheet, in source order. A `@media`
 * contributes its inner rules rather than itself, so two stylesheets
 * that differ in one breakpoint rule produce one change and not a
 * rewritten block. Every other at-rule is one slot, compared whole.
 */
export declare const cssSlots: (css: string) => SlotEntry[];
/**
 * What to change in `base` so its rules say what `next` says. Slots
 * present in both with identical declarations produce nothing, which is
 * the whole point: an untouched rule is never rewritten.
 *
 * `base` is the file on disk and `next` is freshly generated, so a
 * difference in formatting alone still shows up as a change for that
 * one rule. Whitespace inside a declaration list is normalised away
 * first, so re-indentation on its own is not a change.
 */
export declare const cssRuleChanges: (base: string, next: string) => CssChange[];
/**
 * Apply changes to a stylesheet. A slot that exists is rewritten in
 * place; a new one is inserted where `order` says it belongs, next to
 * a neighbour that already exists, so a new element's rule doesn't land
 * at the bottom of the file. `order` is the generated stylesheet the
 * changes came from.
 */
export declare const applyCssChanges: (source: string, changes: ReadonlyArray<CssChange>, order: string) => string;
export {};
