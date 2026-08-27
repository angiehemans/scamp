/**
 * Classify what a `background` value actually is, so the canvas can put it
 * on the right CSS property.
 *
 * `generateCode` writes the **shorthand** (`background: <value>`), which
 * happily takes a colour, a gradient, or an image. The canvas renders via
 * inline styles and deliberately uses longhands, so that a `background-image`
 * or `background-size` arriving through `customProperties` isn't wiped by a
 * competing shorthand. The bug that motivated this: the canvas put every
 * value on `backgroundColor`, and `background-color: radial-gradient(…)` is
 * invalid CSS — the browser drops it, so gradients rendered in the preview
 * and not on the canvas.
 *
 * The fix is to keep using longhands and pick the correct one.
 *
 * see docs/notes/canvas-gradient-backgrounds.md
 */

export type BackgroundKind =
  /** A plain colour — `#fff`, `rgb(…)`, `var(--accent)`, `transparent`. */
  | 'color'
  /** An image value — a gradient or `url(…)` — belongs on background-image. */
  | 'image'
  /**
   * A layered/positioned shorthand (`url(x) center / cover no-repeat`) that
   * no single longhand expresses. Has to go on the shorthand.
   */
  | 'shorthand';

/**
 * True when `value` contains `char` outside of any parentheses. Used to spot
 * the `/` that separates position from size in a background shorthand,
 * without tripping over the slashes inside `rgb(0 0 0 / 50%)` or a `url(…)`.
 */
const hasTopLevel = (value: string, char: string): boolean => {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < value.length; i += 1) {
    const c = value[i] ?? '';
    if (quote !== null) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth += 1;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === char && depth === 0) return true;
  }
  return false;
};

const IMAGE_FUNCTION = /(^|[\s,(])(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(|(^|[\s,(])(?:image-set|url)\s*\(/i;

/**
 * Keywords that only appear in a positioned background shorthand. A value
 * carrying one of these needs the shorthand even without a `/`.
 */
const SHORTHAND_KEYWORD =
  /(^|\s)(no-repeat|repeat-x|repeat-y|space|round|fixed|local|scroll|border-box|padding-box|content-box)(\s|$)/i;

export const classifyBackgroundValue = (raw: string): BackgroundKind => {
  const value = raw.trim();
  if (value.length === 0) return 'color';
  if (!IMAGE_FUNCTION.test(value)) return 'color';
  // It's image-ish. A top-level `/` means position/size came along, and a
  // repeat/attachment/box keyword means the same — neither fits
  // `background-image` alone.
  if (hasTopLevel(value, '/') || SHORTHAND_KEYWORD.test(value)) {
    return 'shorthand';
  }
  return 'image';
};

/** Convenience: does this value belong on `background-image`? */
export const isImageBackground = (raw: string): boolean =>
  classifyBackgroundValue(raw) === 'image';
