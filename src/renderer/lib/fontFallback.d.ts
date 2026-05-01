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
/**
 * Guess a generic CSS fallback category from a family name. Best-effort
 * heuristic — unknown names default to `sans-serif`, which is the
 * safest fallback for UI text.
 */
export declare const inferFallback: (family: string) => FontCategory;
/**
 * Quote a family name if CSS requires it. CSS allows bare identifiers
 * for families like `Arial` or `Helvetica-Bold`, but anything
 * containing whitespace, punctuation, or starting with a digit must
 * be quoted. Already-quoted input is returned as-is.
 */
export declare const quoteFamilyName: (family: string) => string;
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
export declare const formatFontValue: (family: string) => string;
