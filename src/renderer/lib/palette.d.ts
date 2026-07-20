/** Standard 50–900 shade scale for a generated colour palette. */
export declare const PALETTE_SHADES: readonly [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
export type PaletteShade = {
    shade: number;
    value: string;
};
/**
 * Generate a 10-shade (50–900) palette from a single seed colour using OKLCH:
 * keep the seed's hue, walk lightness across the scale, and taper chroma
 * toward the light/dark ends where high chroma leaves the sRGB gamut. Returns
 * hex values, or `[]` if the seed can't be parsed.
 * see docs/plans/design-system-plan.md
 */
export declare const generatePalette: (seedHex: string) => PaletteShade[];
