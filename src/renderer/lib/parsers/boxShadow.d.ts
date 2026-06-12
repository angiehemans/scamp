import { type BoxShadowDef } from "../element";
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
