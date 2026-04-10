import { DEFAULT_RECT_STYLES } from './defaults';
import type { BorderStyle } from './element';

/**
 * Parse a `123px` (or bare number) into an integer. Returns 0 for empty
 * or unparseable input — keeps callers from having to special-case missing
 * values themselves.
 */
export const parsePx = (raw: string): number => {
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 0;
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(?:px)?$/);
  if (!match || match[1] === undefined) return 0;
  return Math.round(Number(match[1]));
};

const VALID_BORDER_STYLES: ReadonlySet<string> = new Set([
  'none',
  'solid',
  'dashed',
  'dotted',
  'double',
  'groove',
  'ridge',
  'inset',
  'outset',
]);

const isBorderStyle = (token: string): token is BorderStyle =>
  token === 'none' || token === 'solid' || token === 'dashed' || token === 'dotted';

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
export const parseBorderShorthand = (raw: string): ParsedBorder => {
  const fallback: ParsedBorder = {
    borderWidth: 0,
    borderStyle: DEFAULT_RECT_STYLES.borderStyle,
    borderColor: DEFAULT_RECT_STYLES.borderColor,
  };
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return fallback;

  const tokens = tokenizeBorder(trimmed);
  if (tokens.length === 0) return fallback;

  // `border: none` (or `0`) — no border at all.
  if (tokens.length === 1) {
    const only = tokens[0]!;
    if (only === 'none' || only === '0' || only === '0px') {
      return { borderWidth: 0, borderStyle: 'none', borderColor: fallback.borderColor };
    }
  }

  let width: number | null = null;
  let style: BorderStyle | null = null;
  let color: string | null = null;

  for (const token of tokens) {
    if (width === null && /^-?\d+(?:\.\d+)?(?:px)?$/.test(token)) {
      width = parsePx(token);
      continue;
    }
    if (style === null && VALID_BORDER_STYLES.has(token)) {
      // Anything outside the supported subset collapses to `solid` so the
      // canvas still draws something visible. Round-trip preserves the
      // original via customProperties when used at the top level.
      style = isBorderStyle(token) ? token : 'solid';
      continue;
    }
    if (color === null) {
      color = token;
    }
  }

  return {
    borderWidth: width ?? fallback.borderWidth,
    borderStyle: style ?? fallback.borderStyle,
    borderColor: color ?? fallback.borderColor,
  };
};

const tokenizeBorder = (input: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let depth = 0;
  for (const ch of input) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (/\s/.test(ch) && depth === 0) {
      if (current.length > 0) tokens.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
};

/**
 * Parse a CSS `padding` shorthand into [top, right, bottom, left] in px.
 *
 * Supports the standard 1-, 2-, 3-, and 4-value forms.
 */
export const parsePaddingShorthand = (
  raw: string
): [number, number, number, number] => {
  if (typeof raw !== 'string') return [0, 0, 0, 0];
  const tokens = raw.trim().split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return [0, 0, 0, 0];

  const v = tokens.map(parsePx);

  if (v.length === 1) {
    const [a] = v as [number];
    return [a, a, a, a];
  }
  if (v.length === 2) {
    const [a, b] = v as [number, number];
    return [a, b, a, b];
  }
  if (v.length === 3) {
    const [a, b, c] = v as [number, number, number];
    return [a, b, c, b];
  }
  const [a, b, c, d] = v as [number, number, number, number];
  return [a, b, c, d];
};

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
export const parseBorderRadiusShorthand = (
  raw: string
): [number, number, number, number] => {
  if (typeof raw !== 'string') return [0, 0, 0, 0];
  // Strip everything after `/` (vertical radius for elliptical corners).
  const horizontal = raw.split('/')[0] ?? '';
  const tokens = horizontal.trim().split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return [0, 0, 0, 0];

  const v = tokens.map(parsePx);

  if (v.length === 1) {
    const [a] = v as [number];
    return [a, a, a, a];
  }
  if (v.length === 2) {
    const [a, b] = v as [number, number];
    return [a, b, a, b];
  }
  if (v.length === 3) {
    const [a, b, c] = v as [number, number, number];
    return [a, b, c, b];
  }
  const [a, b, c, d] = v as [number, number, number, number];
  return [a, b, c, d];
};
