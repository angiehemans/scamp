import { type KeyframesBlock, type ScampElement } from "../element";
import { type RawDeclaration } from "./css";
import { type Breakpoint } from "@shared/types";
/**
 * Pure function: real TSX + CSS module text → canvas state.
 *
 * Inverse of `generateCode`. Reads no external state. Always returns a
 * tree rooted at ROOT_ELEMENT_ID — if the input file is missing or
 * malformed, the result is a tree containing only an empty root.
 */
export type ParsedTree = {
    elements: Record<string, ScampElement>;
    rootId: string;
    /**
     * True when the parser detected the legacy root-sizing three-tuple
     * (`width: Npx` + `min-height: Mpx` + `position: relative`) and
     * stripped it so the new stretch/auto defaults apply. Used by the
     * UI to show a one-time migration banner. Idempotent: once the
     * root's CSS is rewritten without the old three-tuple, subsequent
     * parses return `false`.
     */
    migrated?: boolean;
    /**
     * Any `@media` blocks the parser couldn't match to a known
     * breakpoint — agent-written `min-width` queries, prefers-color-
     * scheme, orientation, and custom max-widths that aren't in the
     * project config. Preserved verbatim as raw CSS so `generateCode`
     * can re-emit them untouched.
     */
    customMediaBlocks: string[];
    /**
     * `@keyframes` blocks collected from the page, in source order.
     * Travel together at the page level rather than per-element since
     * multiple elements can reference the same keyframe name. The
     * canvas store mirrors this list so `generateCode` can re-emit
     * them on every save.
     */
    keyframesBlocks: KeyframesBlock[];
    /**
     * Per-element list of CSS property names that appeared more than
     * once in the element's base class block. Empty array (or absent
     * key) when no duplicates were seen. The cascade picks last-wins so
     * Scamp's typed state reflects the final declaration; this map lets
     * the UI surface a warning indicator on the affected section so
     * users know the file is in a non-canonical state. Editing any
     * field on the element via the panel triggers the generator to
     * rewrite the class block from typed state, which removes the
     * duplicates.
     *
     * Per-state and per-breakpoint duplicates aren't tracked here yet —
     * they're rarer and the same cleanup path applies (any panel edit
     * collapses them). Future-extensible.
     */
    cssDuplicates: Record<string, ReadonlyArray<string>>;
};
export type ParseCodeOptions = {
    /**
     * The project's breakpoint table. Used to route `@media
     * (max-width: Npx)` declarations into `element.breakpointOverrides`
     * keyed by the matching breakpoint's id. When omitted, defaults
     * are used — handy for tests and for call sites that don't have
     * project config loaded yet.
     */
    breakpoints?: ReadonlyArray<Breakpoint>;
    /**
     * `true` when parsing a component file (mirrors `generateCode`'s
     * `isComponent`). A component root drops the page-root `100vh`
     * min-height floor and an inherited `min-height: 100vh` is stripped
     * so it stops round-tripping back into the file. Callers that handle
     * both pages and components pass `target.kind === 'component'`.
     * see docs/notes/component-min-height-floor.md
     */
    isComponent?: boolean;
};
/**
 * Return the set of CSS property names that appear more than once in
 * a declaration list. Used to surface a warning indicator in the
 * panel when an agent or hand edit left two `height: …` (or any
 * other property) declarations in the same block.
 *
 * Order is preserved by first appearance so callers that render the
 * list to the user get a stable order.
 */
export declare const findDuplicateDeclProps: (decls: ReadonlyArray<RawDeclaration>) => string[];
export declare const parseCode: (tsx: string, css: string, options?: ParseCodeOptions) => ParsedTree;
