// parsers/size.ts — split out of parsers.ts (4.3).
import { type HeightMode, type WidthMode } from "../element";

// ---- Free-form width / height parsing -------------------------------
//
// The Size section's W/H inputs accept any CSS length (`100`, `100px`,
// `100vh`, `100%`, `calc(...)`, `var(--w)`, `auto`, `fit-content`).
// These helpers turn the user's typed string into the right
// combination of typed `widthMode` / `widthValue` and the optional
// verbatim `widthCustom` field — the same routing the cssPropertyMap
// mapper uses on parse, exposed for the panel to share.

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


const PLAIN_PX_RE = /^(-?\d+(?:\.\d+)?)(?:px)?$/i;

const LEADING_NUMBER_RE = /^(-?\d+(?:\.\d+)?)/;


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
export const parseSizeValue = (raw: string): ParsedSizeValue => {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length === 0) return { mode: 'auto', value: 0, custom: undefined };
  const lower = trimmed.toLowerCase();
  if (lower === 'auto') return { mode: 'auto', value: 0, custom: undefined };
  if (lower === 'fit-content') {
    return { mode: 'fit-content', value: 0, custom: undefined };
  }
  if (lower === '100%') {
    return { mode: 'stretch', value: 0, custom: undefined };
  }

  const px = trimmed.match(PLAIN_PX_RE);
  if (px) {
    return {
      mode: 'fixed',
      value: Math.round(Number(px[1])),
      custom: undefined,
    };
  }

  // Anything else: keep verbatim, plus a best-effort numeric prefix
  // so the canvas's resize math has something to fall back on.
  const lead = trimmed.match(LEADING_NUMBER_RE);
  const leadValue = lead ? Math.round(Number(lead[1])) : 0;
  return { mode: 'fixed', value: leadValue, custom: trimmed };
};


/**
 * Inverse of `parseSizeValue` — formats the typed shape back into a
 * single CSS length string. Used by the Size section's input field
 * so the user sees what the canvas / generator will emit.
 */
export const formatSizeValue = (
  mode: WidthMode | HeightMode,
  value: number,
  custom: string | undefined
): string => {
  if (mode === 'fixed') {
    if (custom !== undefined && custom.length > 0) return custom;
    return `${value}px`;
  }
  if (mode === 'stretch') return '100%';
  if (mode === 'fit-content') return 'fit-content';
  return 'auto';
};

