import { type ScampElement } from "../element";
/**
 * The CSS class name for an element. When the element has a custom name,
 * the slugified name replaces the type prefix:
 *   - unnamed rect → `rect_a1b2`
 *   - named "Hero Card" → `hero-card_a1b2`
 *   - root → `root` (always)
 */
export declare const classNameFor: (el: ScampElement) => string;
/** The actual tag to emit / render — explicit override wins over the default. */
export declare const tagFor: (el: ScampElement) => string;
/**
 * Collect the set of element IDs that need to establish a positioning
 * context (`position: relative` or similar) so their absolute-positioned
 * descendants anchor locally instead of escaping to a remote ancestor.
 *
 * An element needs a positioning context iff at least one of its direct
 * children will resolve to `position: absolute` in the output. A child
 * resolves to absolute when:
 *
 *   - `child.position === 'absolute'` (explicit), OR
 *   - `child.position === 'auto'` AND the parent isn't a flex/grid
 *     container (the generator's own auto rule — non-layout-parent
 *     auto children get absolute + left/top emitted).
 *
 * Root is always emitted with `position: relative` anyway, so it's
 * excluded — caller's existing branch handles it.
 *
 * See agent.md "Editability — prefer typed properties" / Scamp's
 * fallback positioning rules.
 */
export declare const computeElementsNeedingPositioningContext: (elements: Record<string, ScampElement>, rootId: string) => Set<string>;
