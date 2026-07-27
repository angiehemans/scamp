// @lib/readableTextColor.ts — pick a legible text color (near-black or
// near-white) for a card tinted with an arbitrary background color, so a
// user-chosen card color stays readable in either direction. Pure +
// unit-tested.

/** Near-white text for dark backgrounds. */
export const LIGHT_TEXT = '#f4f4f5';
/** Near-black text for light backgrounds. */
export const DARK_TEXT = '#18181b';

/** Parse a `#hex` (3/4/6/8) or `rgb()/rgba()` color to `[r,g,b]`, else null. */
const toRgb = (color: string): [number, number, number] | null => {
  const c = color.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(c);
  if (hex) {
    let h = hex[1] ?? '';
    if (h.length === 3 || h.length === 4) {
      h = h
        .split('')
        .map((ch) => ch + ch)
        .join('');
    }
    if (h.length !== 6 && h.length !== 8) return null;
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(c);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return null;
};

/** Perceived brightness (0–255) via the classic YIQ weighting. */
const brightness = ([r, g, b]: [number, number, number]): number =>
  (r * 299 + g * 587 + b * 114) / 1000;

/**
 * A legible text color for a card whose background is `background`.
 * Light backgrounds get dark text; everything else (dark colors, and any
 * value we can't parse — the app's dark theme) gets light text.
 */
export const readableTextColor = (background: string | undefined): string => {
  if (!background) return LIGHT_TEXT;
  const rgb = toRgb(background);
  if (!rgb) return LIGHT_TEXT;
  return brightness(rgb) > 145 ? DARK_TEXT : LIGHT_TEXT;
};
