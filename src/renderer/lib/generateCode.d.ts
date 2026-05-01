import { type BreakpointOverride, type KeyframesBlock, type ScampElement } from './element';
import { type Breakpoint } from '@shared/types';
/**
 * Pure function: produces real TSX + CSS module text from canvas state.
 *
 * Contract guarantees (also enforced by tests):
 *   - Output is deterministic — same input always produces the same output
 *   - Only emits CSS properties that differ from DEFAULT_RECT_STYLES
 *   - `customProperties` always go in verbatim, last, in their original order
 *   - The depth-first traversal matches the parent → childIds order
 *   - Text content is HTML-escaped
 *   - The function reads no external state — no Date.now, no Math.random
 */
export type GenerateCodeArgs = {
    elements: Record<string, ScampElement>;
    rootId: string;
    pageName: string;
    /**
     * Project's breakpoint table, ordered widest first. Used to emit
     * `@media (max-width: Npx)` blocks after the base class rules.
     * When omitted (or only contains desktop), no `@media` output is
     * emitted — backwards-compatible with callers that predate the
     * breakpoints feature.
     */
    breakpoints?: ReadonlyArray<Breakpoint>;
    /**
     * Raw `@media` blocks that the parser couldn't match to a known
     * breakpoint. Appended verbatim at the very end of the CSS so
     * agent-written / hand-written queries round-trip untouched.
     */
    customMediaBlocks?: ReadonlyArray<string>;
    /**
     * `@keyframes` blocks for the page. Emitted between the per-element
     * chunks and the `@media` blocks, in the order given. Multiple
     * elements can reference the same keyframe name; the block list
     * deduplicates by name on parse, so we trust the input here.
     */
    pageKeyframesBlocks?: ReadonlyArray<KeyframesBlock>;
    /**
     * Basename (no extension) of the CSS module the TSX should import.
     * The single point of divergence between the legacy flat layout
     * (where each page imports `./<pageName>.module.css` because all
     * pages share a folder) and the Next.js App Router layout (where
     * every page lives in its own folder and imports `./page.module.css`).
     * Defaults to `pageName` for back-compat with legacy callers.
     */
    cssModuleImportName?: string;
};
export type GeneratedCode = {
    tsx: string;
    css: string;
};
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
 * Build the list of `prop: value;` lines for one element. Skips anything
 * equal to its default; appends customProperties verbatim at the end.
 *
 * Exported so the properties panel can render what would be written to
 * disk for the selected element without having to re-implement the rules.
 */
export declare const elementDeclarationLines: (el: ScampElement, parent?: ScampElement | null) => string[];
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
export declare const generateCode: (args: GenerateCodeArgs) => GeneratedCode;
/**
 * Legacy flat-layout entry point. Equivalent to calling `generateCode`
 * with `cssModuleImportName: pageName` — kept as a separate name so the
 * call site reads as "this code path is for legacy projects" and so the
 * legacy path is straightforward to delete once the format is retired.
 */
export declare const generateCodeLegacy: (args: GenerateCodeArgs) => GeneratedCode;
