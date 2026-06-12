// parsers/color.ts — split out of parsers.ts (4.3).
import { requireGroup } from "../safeAccess";

// ---- Shadow color decomposition --------------------------------------
//
// The Shadow section surfaces the color and the alpha as two separate
// controls (a ColorInput for the base hex, and a NumberInput for the
// opacity %). The data layer keeps storing the combined CSS string in
// `BoxShadowDef.color` — these helpers split / re-combine for the UI.
//
// `var()`, named colors, `currentColor`, and other non-decomposable
// values are returned as-is with `decomposable: false` so the section
// can disable the opacity field rather than silently flattening a
// token reference.

const HEX6_COLOR_RE = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;

const HEX3_COLOR_RE = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;

const RGBA_COLOR_RE =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(-?[\d.]+)\s*)?\)$/;


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


const formatHex2 = (n: number): string => {
  const clamped = Math.max(0, Math.min(255, Math.round(n)));
  return clamped.toString(16).padStart(2, '0');
};


const rgbToHex = (r: number, g: number, b: number): string =>
  `#${formatHex2(r)}${formatHex2(g)}${formatHex2(b)}`;


export const splitShadowColor = (value: string): SplitShadowColor => {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) {
    return { base: '#000000', alpha: 1, decomposable: true, hasExplicitAlpha: false };
  }
  const hex6 = trimmed.match(HEX6_COLOR_RE);
  if (hex6) {
    return {
      base: `#${requireGroup(hex6, 1).toLowerCase()}${requireGroup(hex6, 2).toLowerCase()}${requireGroup(hex6, 3).toLowerCase()}`,
      alpha: 1,
      decomposable: true,
      hasExplicitAlpha: false,
    };
  }
  const hex3 = trimmed.match(HEX3_COLOR_RE);
  if (hex3) {
    const r = requireGroup(hex3, 1);
    const g = requireGroup(hex3, 2);
    const b = requireGroup(hex3, 3);
    return {
      base: `#${r}${r}${g}${g}${b}${b}`.toLowerCase(),
      alpha: 1,
      decomposable: true,
      hasExplicitAlpha: false,
    };
  }
  const rgba = trimmed.match(RGBA_COLOR_RE);
  if (rgba) {
    const r = Number(rgba[1]);
    const g = Number(rgba[2]);
    const b = Number(rgba[3]);
    const aRaw = rgba[4];
    const alpha = aRaw === undefined ? 1 : Math.max(0, Math.min(1, Number(aRaw)));
    return {
      base: rgbToHex(r, g, b),
      alpha,
      decomposable: true,
      hasExplicitAlpha: aRaw !== undefined,
    };
  }
  // var(), currentColor, named colors, modern color() / oklch() … —
  // can't decompose without resolving the value. Surface as-is.
  return { base: trimmed, alpha: 1, decomposable: false, hasExplicitAlpha: false };
};


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
export const combineShadowColor = (base: string, alpha: number): string => {
  const trimmedBase = (base ?? '').trim();
  if (trimmedBase.length === 0) return '';
  const a = Math.max(0, Math.min(1, alpha));

  const hex6 = trimmedBase.match(HEX6_COLOR_RE);
  if (hex6) {
    const r = parseInt(requireGroup(hex6, 1), 16);
    const g = parseInt(requireGroup(hex6, 2), 16);
    const b = parseInt(requireGroup(hex6, 3), 16);
    return `rgba(${r}, ${g}, ${b}, ${formatAlpha(a)})`;
  }
  const hex3 = trimmedBase.match(HEX3_COLOR_RE);
  if (hex3) {
    const r = parseInt(requireGroup(hex3, 1) + requireGroup(hex3, 1), 16);
    const g = parseInt(requireGroup(hex3, 2) + requireGroup(hex3, 2), 16);
    const b = parseInt(requireGroup(hex3, 3) + requireGroup(hex3, 3), 16);
    return `rgba(${r}, ${g}, ${b}, ${formatAlpha(a)})`;
  }
  const rgba = trimmedBase.match(RGBA_COLOR_RE);
  if (rgba) {
    const r = Number(rgba[1]);
    const g = Number(rgba[2]);
    const b = Number(rgba[3]);
    return `rgba(${r}, ${g}, ${b}, ${formatAlpha(a)})`;
  }
  // var() / named / unknown — return verbatim. The opacity slider
  // should be disabled in this case anyway.
  return trimmedBase;
};


/**
 * Trim trailing zeros on the alpha component while keeping at most
 * three decimal places. Keeps the file output readable: `0.15` rather
 * than `0.15000000000000002`.
 */
const formatAlpha = (a: number): string => {
  if (a === 0) return '0';
  if (a === 1) return '1';
  return Number(a.toFixed(3)).toString();
};

