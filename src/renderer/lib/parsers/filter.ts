// parsers/filter.ts — split out of parsers.ts (4.3).
import { type FilterDef, type FilterKind } from "../element";
import { FILTER_UNITS, isFilterKind } from "../filterKinds";
import { requireGroup } from "../safeAccess";
import { tokenizeShorthandSegment } from "./common";

// ---- CSS filters ----------------------------------------------------

const FILTER_CALL_RE = /^([a-zA-Z-]+)\(([^()]*)\)$/;


/**
 * Format a numeric argument compactly — strips trailing zeros so
 * `4.00` becomes `4` and `120.50` becomes `120.5`. Keeps integer
 * inputs integer.
 */
const formatFilterNumber = (n: number): string => {
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toFixed(4)));
};


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
export const parseFilterFunction = (segment: string): FilterDef | null => {
  if (typeof segment !== 'string') return null;
  const trimmed = segment.trim();
  if (trimmed.length === 0) return null;

  const match = trimmed.match(FILTER_CALL_RE);
  if (!match) return null;

  const name = requireGroup(match, 1).toLowerCase();
  if (!isFilterKind(name)) return null;

  const kind: FilterKind = name;
  const arg = requireGroup(match, 2).trim();
  if (arg.length === 0) return null;

  const expectedUnit = FILTER_UNITS[kind];

  // Unitless zero is allowed for blur (length-typed kind only).
  if (expectedUnit === 'px' && /^-?0(?:\.0+)?$/.test(arg)) {
    return { kind, value: 0 };
  }

  // Build a unit-specific regex once per call. Each kind only
  // accepts its canonical unit — any other unit refuses.
  let numberPart: string | null = null;
  if (expectedUnit === 'px') {
    const m = arg.match(/^(-?\d+(?:\.\d+)?)px$/i);
    if (m) numberPart = requireGroup(m, 1);
  } else if (expectedUnit === '%') {
    const m = arg.match(/^(-?\d+(?:\.\d+)?)%$/);
    if (m) numberPart = requireGroup(m, 1);
  } else if (expectedUnit === 'deg') {
    const m = arg.match(/^(-?\d+(?:\.\d+)?)deg$/i);
    if (m) numberPart = requireGroup(m, 1);
  }

  if (numberPart === null) return null;
  const value = Number(numberPart);
  if (!Number.isFinite(value)) return null;

  return { kind, value };
};


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
export const parseFilterList = (
  raw: string
): ReadonlyArray<FilterDef> | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === 'none') return [];
  const tokens = tokenizeShorthandSegment(trimmed);
  if (tokens.length === 0) return null;
  const result: FilterDef[] = [];
  for (const token of tokens) {
    const parsed = parseFilterFunction(token);
    if (parsed === null) return null;
    result.push(parsed);
  }
  return result;
};


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
export const formatFilterList = (
  filters: ReadonlyArray<FilterDef>
): string => {
  if (filters.length === 0) return '';
  return filters
    .map((f) => `${f.kind}(${formatFilterNumber(f.value)}${FILTER_UNITS[f.kind]})`)
    .join(' ');
};

