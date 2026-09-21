/**
 * Edits anchored to the element they are about.
 *
 * Phase 3 rewrites whole regions: change one word of text and the
 * component function is replaced with the generated one, so a
 * multi-line opening tag or an unusual indentation someone chose is
 * lost. With `parseCode` reporting a range per element (phase 5), an
 * edit can address the element instead — its opening tag, or the text
 * between its tags — and everything around it stays exactly as
 * written.
 *
 * This only ever narrows. It returns null whenever it cannot explain
 * the difference between two files in terms of individual elements —
 * an element added or removed, a tree reshaped, a change to the props
 * type — and the caller falls back to the region path.
 *
 * see docs/plans/incremental-writes-plan.md, phase 5
 */
import type { ScampElement } from './element';
import type { SourceRange } from './parseCode/tsx';
import type { TextEdit } from './textEdits';
export type EditSide = {
    text: string;
    elements: Record<string, ScampElement>;
    ranges: Record<string, SourceRange>;
};
/**
 * The edits that bring `base` in line with `next`, one per changed
 * element. Empty means the two files describe the same design and the
 * component needs no edit at all — which is the common case for a file
 * Scamp did not write, where the text differs everywhere and the
 * design differs nowhere. Null means the difference is not
 * element-shaped and the caller should fall back.
 */
export declare const elementEdits: (base: EditSide, next: EditSide) => TextEdit[] | null;
/**
 * A save's edits with the component region's rewrite replaced by
 * element-anchored ones. Everything outside the component is still
 * region work — the props type and the imports are not elements — so
 * this is the region path with a finer middle.
 *
 * Null means the difference was not element-shaped, and the caller
 * should use `tsxEdits`. The result is still verified before it is
 * written: a change the elements cannot account for, such as an added
 * prop reaching the destructure, parses differently and falls back.
 */
export declare const tsxSurgicalEdits: (base: EditSide, next: EditSide) => TextEdit[] | null;
