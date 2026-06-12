// parsers/border.ts — split out of parsers.ts (4.3).
import { DEFAULT_RECT_STYLES } from "../defaults";
import { type BorderStyle } from "../element";
import { requireAt } from "../safeAccess";
import { parsePx } from "./common";
import { tokenizeBorder } from "./internal";

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
    const only = requireAt(tokens, 0);
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

