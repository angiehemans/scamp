/**
 * Font-family fallback inference and CSS value formatting.
 *
 * When the user picks a font from the font picker we store a full
 * `"Family Name", <category>` expression so the generated CSS still
 * renders on machines without the chosen font. The category is
 * inferred once at pick time; hand-edits round-trip untouched because
 * everything downstream treats `fontFamily` as an opaque string.
 */

export type FontCategory = 'sans-serif' | 'serif' | 'monospace' | 'cursive';

const MONOSPACE_HINTS = [
  'mono',
  'code',
  'courier',
  'consolas',
  'menlo',
  'fira code',
  'source code',
];
const SERIF_HINTS = [
  'serif',
  'times',
  'georgia',
  'garamond',
  'playfair',
  'merriweather',
  'baskerville',
  'cambria',
];
const CURSIVE_HINTS = [
  'script',
  'hand',
  'brush',
  'pacifico',
  'lobster',
  'dancing',
  'caveat',
];

/**
 * Guess a generic CSS fallback category from a family name. Best-effort
 * heuristic — unknown names default to `sans-serif`, which is the
 * safest fallback for UI text.
 */
export const inferFallback = (family: string): FontCategory => {
  const lower = family.toLowerCase();
  for (const hint of MONOSPACE_HINTS) {
    if (lower.includes(hint)) return 'monospace';
  }
  for (const hint of SERIF_HINTS) {
    if (lower.includes(hint)) return 'serif';
  }
  for (const hint of CURSIVE_HINTS) {
    if (lower.includes(hint)) return 'cursive';
  }
  return 'sans-serif';
};

const NEEDS_QUOTING_RE = /[\s'"(),/\\]|^[^a-zA-Z_-]/;

/**
 * Quote a family name if CSS requires it. CSS allows bare identifiers
 * for families like `Arial` or `Helvetica-Bold`, but anything
 * containing whitespace, punctuation, or starting with a digit must
 * be quoted. Already-quoted input is returned as-is.
 */
export const quoteFamilyName = (family: string): string => {
  const trimmed = family.trim();
  if (trimmed.length === 0) return trimmed;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed;
  }
  if (NEEDS_QUOTING_RE.test(trimmed)) {
    return `"${trimmed}"`;
  }
  return trimmed;
};

/**
 * Format a family name into a full CSS `font-family` value, including
 * a fallback category. Callers write this directly into
 * `element.fontFamily`.
 *
 * @example
 *   formatFontValue('Helvetica Neue') // '"Helvetica Neue", sans-serif'
 *   formatFontValue('Fira Code')      // '"Fira Code", monospace'
 *   formatFontValue('Arial')          // 'Arial, sans-serif'
 */
export const formatFontValue = (family: string): string => {
  const trimmed = family.trim();
  if (trimmed.length === 0) return '';
  const quoted = quoteFamilyName(trimmed);
  const fallback = inferFallback(trimmed);
  return `${quoted}, ${fallback}`;
};
