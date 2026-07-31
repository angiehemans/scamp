import { type BreakpointOverride, type ScampElement } from "../element";
/**
 * The `width:` / `height:` lines for one element, measured against the
 * default set that applies to it.
 *
 * The 'auto' mode is the implicit CSS default (no declaration), so it
 * deliberately emits nothing — that's how round-trips stay text-stable for
 * files that simply omit a width or height.
 *
 * Split out because a component instance emits ONLY these two properties
 * (everything else about an instance lives in the component definition).
 * see docs/notes/components-data-model.md
 */
export declare const sizeDeclarationLines: (el: ScampElement, base?: {
    widthValue: number;
    heightValue: number;
}) => string[];
/**
 * Build the list of `prop: value;` lines for one element. Skips anything
 * equal to its default; appends customProperties verbatim at the end.
 *
 * Exported so the properties panel can render what would be written to
 * disk for the selected element without having to re-implement the rules.
 */
export declare const elementDeclarationLines: (el: ScampElement, parent?: ScampElement | null, 
/**
 * When true, this element has at least one descendant that will
 * be `position: absolute` and would otherwise escape to a remote
 * ancestor's positioning context (or all the way to `.root`).
 * We emit `position: relative` here so the descendant anchors
 * locally — even when `el.position === 'auto'` would normally
 * emit nothing. See `computeElementsNeedingPositioningContext`.
 */
mustEstablishPositioningContext?: boolean) => string[];
/**
 * Emit CSS declarations for a single breakpoint override. Unlike
 * `elementDeclarationLines` (which skips values equal to defaults),
 * this emits a declaration for every field explicitly set in the
 * override — the override's presence IS the user's intent.
 *
 * Paired with the element so width/height declarations can resolve
 * the mode+value combination. When only `widthMode` is in the
 * override, the value falls back to the element's base value.
 */
export declare const breakpointOverrideLines: (override: BreakpointOverride, element: ScampElement) => string[];
