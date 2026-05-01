import type { BorderStyle, ElementAnimation, TransitionDef } from './element';
/**
 * Parse a `123px` (or bare number) into an integer. Returns 0 for empty
 * or unparseable input — keeps callers from having to special-case missing
 * values themselves.
 */
export declare const parsePx: (raw: string) => number;
export type ParsedBorder = {
    borderWidth: number;
    borderStyle: BorderStyle;
    borderColor: string;
};
/**
 * Parse a CSS `border` shorthand into the three scamp fields.
 *
 * Tokenization is space-separated, with one wrinkle: rgb()/rgba() and similar
 * function-call colors contain spaces inside parens that are NOT separators.
 * We collapse anything inside `()` first.
 *
 * Empty input returns the documented defaults so the parser can use this
 * as a single source of truth without needing to track absence separately.
 */
export declare const parseBorderShorthand: (raw: string) => ParsedBorder;
/**
 * Parse a CSS `padding` shorthand into [top, right, bottom, left] in px.
 *
 * Supports the standard 1-, 2-, 3-, and 4-value forms.
 */
export declare const parsePaddingShorthand: (raw: string) => [number, number, number, number];
/**
 * Parse a CSS `border-radius` shorthand into [TL, TR, BR, BL] in px.
 *
 * CSS border-radius shorthand order:
 *   1 value  → all four corners
 *   2 values → (top-left + bottom-right) (top-right + bottom-left)
 *   3 values → top-left (top-right + bottom-left) bottom-right
 *   4 values → top-left top-right bottom-right bottom-left
 *
 * Only the radius part before any `/` is parsed — the vertical radius
 * (elliptical corners) is ignored for POC.
 */
export declare const parseBorderRadiusShorthand: (raw: string) => [number, number, number, number];
/**
 * Split a CSS value-list on top-level commas, respecting parens. Used
 * to break a `transition` shorthand like
 *   `opacity 200ms ease, transform 300ms cubic-bezier(0.4, 0, 0.2, 1)`
 * into per-transition segments without splitting inside cubic-bezier.
 */
export declare const splitCssList: (raw: string) => string[];
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
/**
 * Like `parsePx` but returns `null` for non-px tokens (so callers can
 * preserve `var()`, `%`, `rem`, etc. by falling through to
 * customProperties).
 */
export declare const parsePxOrNull: (raw: string) => number | null;
/**
 * Refusable variant of `parsePaddingShorthand`. Returns `null` if any
 * token is non-px (`var()`, `%`, `rem`, `auto`, …) so the caller can
 * preserve the declaration verbatim.
 */
export declare const parsePaddingShorthandOrNull: (raw: string) => [number, number, number, number] | null;
/**
 * Refusable variant of `parseBorderRadiusShorthand`. Anything other
 * than 1–4 px tokens (e.g. `50%`, `var()`) → returns null so the raw
 * declaration round-trips via customProperties.
 */
export declare const parseBorderRadiusShorthandOrNull: (raw: string) => [number, number, number, number] | null;
/**
 * Parse a single CSS `animation` shorthand value (one animation, no
 * commas) into an `ElementAnimation`. Returns null when no name can
 * be found (the picker can't represent a nameless animation; the
 * caller falls back to `customProperties`).
 *
 * Per the CSS spec, the first `<time>` is duration and the second
 * is delay; iteration is `<number> | infinite`; direction / fill
 * mode / play state are mutually disjoint enum sets so positional
 * disambiguation works. The leftover non-keyword token is the
 * custom-ident name.
 */
export declare const parseAnimationShorthand: (raw: string) => ElementAnimation | null;
/**
 * Format an `ElementAnimation` back into the CSS shorthand.
 *
 * Order: name duration easing delay iteration direction fill-mode
 * play-state. Default values are omitted — but only safely from the
 * tail, since position matters for time tokens (delay is the second
 * time, which means duration must precede it). Easing is positional
 * relative to delay too — emit easing whenever delay is non-default.
 */
export declare const formatAnimationShorthand: (animation: ElementAnimation) => string;
