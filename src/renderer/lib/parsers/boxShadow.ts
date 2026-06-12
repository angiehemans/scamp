// parsers/boxShadow.ts — split out of parsers.ts (4.3).
import { type BoxShadowDef } from "../element";
import { requireAt } from "../safeAccess";
import { parsePxOrNull, splitCssList, tokenizeShorthandSegment } from "./common";

// ---- Box shadow ------------------------------------------------------

const PX_LENGTH_RE = /^-?\d+(?:\.\d+)?(?:px)?$/;


const isInsetKeyword = (token: string): boolean =>
  token.toLowerCase() === 'inset';


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
export const parseBoxShadowSegment = (segment: string): BoxShadowDef | null => {
  const tokens = tokenizeShorthandSegment(segment);
  if (tokens.length === 0) return null;

  let inset = false;
  const remaining: string[] = [];
  for (const token of tokens) {
    if (isInsetKeyword(token)) {
      // Two `inset` tokens in one segment is malformed — bail.
      if (inset) return null;
      inset = true;
      continue;
    }
    remaining.push(token);
  }

  if (remaining.length === 0) return null;

  // Per spec the color may sit at the start OR the end of the segment,
  // but never in the middle of the lengths. Detect which end (if any)
  // holds the color, then require the remaining slice to be all px
  // lengths. A `calc(...)` length, `var(--space-4)`, or a percent
  // therefore refuses cleanly: it's neither at an end nor a px length,
  // so the parse fails and the value falls back to customProperties.
  const firstIsLength = PX_LENGTH_RE.test(requireAt(remaining, 0));
  const lastIsLength = PX_LENGTH_RE.test(requireAt(remaining, remaining.length - 1));

  let color: string | null = null;
  let lengthSlice: string[];
  if (firstIsLength && lastIsLength) {
    lengthSlice = remaining;
  } else if (!firstIsLength && lastIsLength) {
    color = requireAt(remaining, 0);
    lengthSlice = remaining.slice(1);
  } else if (firstIsLength && !lastIsLength) {
    color = requireAt(remaining, remaining.length - 1);
    lengthSlice = remaining.slice(0, remaining.length - 1);
  } else {
    // Both ends are non-length: either zero lengths, two colors, or a
    // refusable expression like `var(--shadow-md)` / `inherit`.
    return null;
  }

  const lengths: number[] = [];
  for (const token of lengthSlice) {
    if (!PX_LENGTH_RE.test(token)) return null;
    const n = parsePxOrNull(token);
    if (n === null) return null;
    lengths.push(n);
  }

  if (lengths.length < 2 || lengths.length > 4) return null;

  const offsetX = requireAt(lengths, 0);
  const offsetY = requireAt(lengths, 1);
  const blur = lengths[2] ?? 0;
  const spread = lengths[3] ?? 0;

  return {
    offsetX,
    offsetY,
    blur,
    spread,
    color: color ?? 'currentColor',
    inset,
  };
};


/**
 * Parse a `box-shadow` shorthand value (single or comma-separated
 * list) into an ordered list of `BoxShadowDef`s. `none`, an empty
 * string, or whitespace returns []. If ANY segment fails to parse,
 * the whole value returns `null` so the caller can fall back to
 * customProperties — partial parses would silently drop user shadows.
 */
export const parseBoxShadowShorthand = (
  raw: string
): ReadonlyArray<BoxShadowDef> | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === 'none') return [];
  const segments = splitCssList(trimmed);
  const result: BoxShadowDef[] = [];
  for (const segment of segments) {
    const parsed = parseBoxShadowSegment(segment);
    if (parsed === null) return null;
    result.push(parsed);
  }
  return result;
};


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
export const formatBoxShadowShorthand = (
  shadows: ReadonlyArray<BoxShadowDef>
): string => {
  if (shadows.length === 0) return '';
  return shadows
    .map((s) => {
      const parts: string[] = [];
      if (s.inset) parts.push('inset');
      parts.push(`${s.offsetX}px`);
      parts.push(`${s.offsetY}px`);
      parts.push(`${s.blur}px`);
      if (s.spread !== 0) parts.push(`${s.spread}px`);
      if (s.color !== 'currentColor') parts.push(s.color);
      return parts.join(' ');
    })
    .join(', ');
};

