import type { BorderStyle, BoxShadowDef, ElementAnimation, FilterDef, HeightMode, TransitionDef, WidthMode } from './element';
import { type SpaceTuple, type SpaceValue } from './spaceValue';
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
 * Split a single CSS shorthand segment into space-separated tokens
 * with parens kept intact. A `cubic-bezier(0.4, 0, 0.2, 1)` or an
 * `rgba(0, 0, 0, 0.15)` is one token even though it contains spaces
 * and commas. Used by the transition and box-shadow parsers.
 */
export declare const tokenizeShorthandSegment: (raw: string) => string[];
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
 * preserve `%`, `rem`, `em`, `auto`, etc. by falling through to
 * customProperties). Plain numbers (no unit), bare zero, and `Npx`
 * all parse to a number.
 */
export declare const parsePxOrNull: (raw: string) => number | null;
export declare const parseVarTokenOrNull: (raw: string) => string | null;
/**
 * Parse a single spacing token — either px (returns `number`) or
 * `var(--name)` (returns the token discriminated form). Anything
 * else returns `null` so the caller can refuse the whole shorthand.
 */
export declare const parseSpaceValueOrNull: (raw: string) => SpaceValue | null;
/**
 * Refusable variant of `parsePaddingShorthand` that returns a
 * `SpaceTuple` (each side is px or `var()`). Returns `null` if any
 * token isn't accepted by `parseSpaceValueOrNull` — keeping declarations
 * with `%`, `rem`, `auto`, etc. flowing into customProperties.
 *
 * Tokens are split on whitespace OUTSIDE parens so values like
 * `var(--a, 16px) var(--b)` parse correctly without splitting the
 * fallback's internal comma-space.
 */
export declare const parsePaddingShorthandOrNull: (raw: string) => SpaceTuple | null;
/**
 * Refusable variant of `parseBorderRadiusShorthand`. 1-4 px or var()
 * tokens are accepted; anything else (`50%`, `1.5em`, the elliptical
 * slash form) returns null so the raw declaration round-trips via
 * customProperties.
 */
export declare const parseBorderRadiusShorthandOrNull: (raw: string) => SpaceTuple | null;
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
/**
 * Parse a single box-shadow segment into a `BoxShadowDef`.
 *
 * Per the CSS spec, a segment is:
 *   `[ inset? && <length>{2,4} && <color>? ]`
 *
 * - 2 lengths: offsetX, offsetY (blur and spread default to 0)
 * - 3 lengths: offsetX, offsetY, blur (spread defaults to 0)
 * - 4 lengths: offsetX, offsetY, blur, spread
 * - `inset` may appear anywhere in the segment
 * - color is optional (defaults to `currentColor`); may appear before
 *   or after the lengths
 *
 * Returns `null` for inputs we can't reduce: missing offsets, a length
 * expressed as `calc(...)` or a token, more than one non-length /
 * non-`inset` token, etc. Callers (the cssPropertyMap mapper) treat
 * null as "preserve verbatim in customProperties".
 */
export declare const parseBoxShadowSegment: (segment: string) => BoxShadowDef | null;
/**
 * Parse a `box-shadow` shorthand value (single or comma-separated
 * list) into an ordered list of `BoxShadowDef`s. `none`, an empty
 * string, or whitespace returns []. If ANY segment fails to parse,
 * the whole value returns `null` so the caller can fall back to
 * customProperties — partial parses would silently drop user shadows.
 */
export declare const parseBoxShadowShorthand: (raw: string) => ReadonlyArray<BoxShadowDef> | null;
/**
 * Inverse of `parseBoxShadowShorthand`. Empty list → empty string; the
 * caller decides whether to emit nothing or `box-shadow: none`.
 *
 * Output format per shadow:
 *   [`inset `]<x>px <y>px <blur>px[ <spread>px][ <color>]
 *
 * Spread is omitted when 0 (matches the "minimal CSS" convention).
 * Color is omitted when it's the spec default `currentColor` so an
 * explicit-defaulted shadow round-trips text-stable.
 */
export declare const formatBoxShadowShorthand: (shadows: ReadonlyArray<BoxShadowDef>) => string;
/**
 * Parse a single filter function call (`blur(8px)`,
 * `brightness(120%)`, `hue-rotate(90deg)`) into a `FilterDef`.
 *
 * The segment must be exactly one balanced function call. The
 * function name is matched case-insensitively against the
 * `FilterKind` set; the argument inside the parens is parsed as a
 * number with the kind's canonical unit.
 *
 * Refuses (returns null) when:
 *   - the function name is not a known `FilterKind`
 *   - the argument is missing, empty, or contains nested parens
 *     (`blur(var(--md))`, `brightness(calc(100% + 20%))`)
 *   - the unit doesn't match the kind (e.g. `blur(50%)`)
 *   - the numeric portion is unparseable
 *
 * Special case: `blur(0)` (unitless zero) parses as `0px` because
 * zero length is unambiguous in CSS. The exemption applies only to
 * the length-typed `blur` kind.
 *
 * Callers (the cssPropertyMap mapper) treat null as
 * "preserve verbatim in customProperties".
 */
export declare const parseFilterFunction: (segment: string) => FilterDef | null;
/**
 * Parse a full `filter` / `backdrop-filter` value (space-separated
 * list of function calls) into an ordered list of `FilterDef`s.
 *
 * `none`, an empty string, or whitespace returns []. If ANY function
 * fails to parse, the whole value returns `null` so the caller can
 * fall back to customProperties — partial parses would silently
 * drop user filters.
 *
 * Tokenization is paren-aware via `tokenizeShorthandSegment` so a
 * hypothetical `drop-shadow(0 4px rgba(0,0,0,0.5))` is one token
 * (which then refuses as an unknown kind and the whole list
 * refuses). Filter functions are space-separated per the CSS spec —
 * commas inside a function's argument list don't separate functions.
 */
export declare const parseFilterList: (raw: string) => ReadonlyArray<FilterDef> | null;
/**
 * Inverse of `parseFilterList`. Empty list → empty string; the
 * caller decides whether to emit nothing or `filter: none`.
 *
 * Output format (one function per token, order preserved, space-
 * joined):
 *   blur(8px) brightness(120%) hue-rotate(90deg)
 *
 * Numeric formatting strips trailing zeros so `8.00` becomes `8` and
 * `120.0` becomes `120`.
 */
export declare const formatFilterList: (filters: ReadonlyArray<FilterDef>) => string;
/**
 * Split a CSS color into a base hex (without alpha) and an alpha 0..1.
 *
 * - `#rrggbb` / `#rgb`         → base = `#rrggbb`, alpha = 1, decomposable
 * - `rgb(r, g, b)` / `rgba(r, g, b, a)` → base = `#rrggbb`, alpha = a ?? 1
 * - anything else (`var()`, `currentColor`, named, …) → base = original
 *   value, alpha = 1, `decomposable: false` — the caller should disable
 *   the opacity slider so the user doesn't lose the token / keyword.
 *
 * Always returns alpha clamped to [0, 1].
 */
export type SplitShadowColor = {
    base: string;
    alpha: number;
    decomposable: boolean;
    /**
     * True when the source value carried an explicit alpha component
     * (an rgba(...) syntax). Lets callers tell "user hasn't set an
     * opacity yet" apart from "user set opacity to 100".
     */
    hasExplicitAlpha: boolean;
};
export declare const splitShadowColor: (value: string) => SplitShadowColor;
/**
 * Inverse of `splitShadowColor`. Given a base color and an alpha 0..1,
 * produce the canonical CSS string the panel writes back to
 * `BoxShadowDef.color`.
 *
 * For decomposable bases (hex / rgb), always emits `rgba(...)` — the
 * Shadows section deliberately normalises here so the file never holds
 * a hex+separate-opacity in two places. Non-decomposable bases (`var()`,
 * `currentColor`, named) are passed through unchanged: an alpha
 * component can't be safely tacked on without losing the reference.
 */
export declare const combineShadowColor: (base: string, alpha: number) => string;
/** A free-form CSS length parsed into Scamp's typed width/height shape. */
export type ParsedSizeValue = {
    mode: WidthMode;
    /**
     * Best-effort integer-pixel value for canvas resize math. Only
     * meaningful when `mode === 'fixed'` — for non-fixed modes the
     * caller should leave the existing `widthValue` / `heightValue`
     * untouched.
     */
    value: number;
    /**
     * Verbatim CSS string when the input wasn't a plain px number.
     * `undefined` for plain `Npx`, mode keywords, or empty input.
     */
    custom: string | undefined;
};
/**
 * Turn a user-typed CSS length into Scamp's width/height shape.
 *
 * Behaviour:
 * - empty / whitespace → `auto` (no value change)
 * - `auto`, `fit-content`, `100%` → matching mode keyword
 * - bare number (`100`) or `Npx` → fixed, value = N, no custom
 * - anything else (`100vh`, `2em`, `calc(...)`, `var(--w)`) → fixed,
 *   value = leading number (or 0 if none), custom = verbatim string
 *
 * The `mode` field is one value of the shared WidthMode/HeightMode
 * union (they're the same union under different aliases). Callers
 * widen as needed.
 */
export declare const parseSizeValue: (raw: string) => ParsedSizeValue;
/**
 * Inverse of `parseSizeValue` — formats the typed shape back into a
 * single CSS length string. Used by the Size section's input field
 * so the user sees what the canvas / generator will emit.
 */
export declare const formatSizeValue: (mode: WidthMode | HeightMode, value: number, custom: string | undefined) => string;
