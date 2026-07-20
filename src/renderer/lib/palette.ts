import { clampChroma, formatHex, oklch } from 'culori';

/** Standard 50–900 shade scale for a generated colour palette. */
export const PALETTE_SHADES = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900,
] as const;

// Target OKLCH lightness per shade — a perceptually even light→dark ramp.
const SHADE_LIGHTNESS: Record<number, number> = {
  50: 0.971,
  100: 0.936,
  200: 0.885,
  300: 0.808,
  400: 0.704,
  500: 0.606,
  600: 0.518,
  700: 0.442,
  800: 0.371,
  900: 0.298,
};

export type PaletteShade = { shade: number; value: string };

/**
 * Generate a 10-shade (50–900) palette from a single seed colour using OKLCH:
 * keep the seed's hue, walk lightness across the scale, and taper chroma
 * toward the light/dark ends where high chroma leaves the sRGB gamut. Returns
 * hex values, or `[]` if the seed can't be parsed.
 * see docs/plans/design-system-plan.md
 */
export const generatePalette = (seedHex: string): PaletteShade[] => {
  const seed = oklch(seedHex);
  if (!seed) return [];
  const h = seed.h ?? 0;
  const c = seed.c ?? 0;
  return PALETTE_SHADES.map((shade) => {
    const l = SHADE_LIGHTNESS[shade] ?? 0.5;
    // Full chroma near the middle of the ramp, reduced toward the extremes.
    const taper = 1 - Math.abs(l - 0.6) * 0.7;
    const clamped = clampChroma(
      { mode: 'oklch', l, c: c * Math.max(0.15, taper), h },
      'oklch'
    );
    return { shade, value: formatHex(clamped) ?? '#000000' };
  });
};
