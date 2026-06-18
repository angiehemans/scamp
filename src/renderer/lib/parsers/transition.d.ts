import { type TransitionDef } from "../element";
/**
 * Parse a single transition segment (`opacity 200ms ease 100ms`) into
 * a TransitionDef. Per the CSS spec, the first `<time>` token is the
 * duration and the second is the delay; any keyword in the easing set
 * (or `cubic-bezier(...)` / `steps(...)`) is the easing; the leftover
 * non-time / non-easing token is the property name.
 */
export declare const parseTransitionSegment: (segment: string) => TransitionDef | null;
/**
 * Parse a `transition` shorthand value into an ordered list of
 * `TransitionDef`s. Input may be a single transition or a
 * comma-separated list. Empty input (or `none`) returns an empty
 * list. Malformed segments are skipped rather than failing the whole
 * parse so an agent edit that includes one bad segment doesn't drop
 * the others.
 */
export declare const parseTransitionShorthand: (raw: string) => ReadonlyArray<TransitionDef>;
/**
 * Format a duration / delay number into the most readable CSS
 * representation. Whole-second values come back as `1s`; everything
 * else stays in `ms`.
 */
export declare const formatTransitionTime: (ms: number) => string;
/**
 * Inverse of `parseTransitionShorthand`. Empty list → empty string;
 * the caller decides whether to emit nothing or `transition: none`.
 */
export declare const formatTransitionShorthand: (transitions: ReadonlyArray<TransitionDef>) => string;
