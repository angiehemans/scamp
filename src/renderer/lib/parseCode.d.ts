import { type KeyframesBlock, type ScampElement } from './element';
import { type Breakpoint } from '@shared/types';
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
};
export declare const parseCode: (tsx: string, css: string, options?: ParseCodeOptions) => ParsedTree;
