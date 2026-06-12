import { type FilterDef } from "../element";
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
