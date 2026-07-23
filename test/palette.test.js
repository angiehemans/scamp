import { describe, it, expect } from 'vitest';
import { oklch } from 'culori';
import { generatePalette, PALETTE_SHADES } from '@lib/palette';
const HEX_RE = /^#[0-9a-f]{6}$/i;
describe('generatePalette', () => {
    it('produces one valid hex per shade in the 50–900 scale', () => {
        const palette = generatePalette('#3b82f6');
        expect(palette.map((p) => p.shade)).toEqual([...PALETTE_SHADES]);
        for (const { value } of palette) {
            expect(value).toMatch(HEX_RE);
        }
    });
    it('ramps from light (50) to dark (900) in perceptual lightness', () => {
        const palette = generatePalette('#3b82f6');
        const lightness = palette.map((p) => oklch(p.value)?.l ?? 0);
        // Strictly decreasing L across the scale.
        for (let i = 1; i < lightness.length; i += 1) {
            expect(lightness[i]).toBeLessThan(lightness[i - 1]);
        }
        // The lightest is very light, the darkest quite dark.
        expect(lightness[0]).toBeGreaterThan(0.9);
        expect(lightness[lightness.length - 1]).toBeLessThan(0.4);
    });
    it('anchors shade 500 to the seed colour exactly', () => {
        const palette = generatePalette('#b91c1c');
        expect(palette.find((p) => p.shade === 500)?.value).toBe('#b91c1c');
    });
    it('shifts the whole ramp to match the seed (a darker seed → darker palette)', () => {
        // Same hue family, different lightness anchors.
        const light = generatePalette('#fca5a5'); // a light red
        const dark = generatePalette('#7f1d1d'); // a dark red
        const l = (p, s) => oklch(p.find((x) => x.shade === s)?.value ?? '')?.l ?? 0;
        // Every shade of the dark-anchored palette is darker than the light one.
        for (const shade of [50, 300, 500, 700, 900]) {
            expect(l(dark, shade)).toBeLessThan(l(light, shade));
        }
    });
    it('preserves the seed hue across the ramp', () => {
        const seedHue = oklch('#3b82f6')?.h ?? -1;
        const palette = generatePalette('#3b82f6');
        // Mid shades carry chroma, so their hue should stay near the seed's.
        for (const shade of [300, 500, 700]) {
            const entry = palette.find((p) => p.shade === shade);
            const h = oklch(entry?.value ?? '')?.h ?? -1;
            expect(Math.abs(h - seedHue)).toBeLessThan(8);
        }
    });
    it('returns an empty palette for an unparseable seed', () => {
        expect(generatePalette('not-a-color')).toEqual([]);
    });
    it('handles a neutral (near-zero-chroma) seed without producing invalid hex', () => {
        const palette = generatePalette('#808080');
        expect(palette).toHaveLength(PALETTE_SHADES.length);
        for (const { value } of palette) {
            expect(value).toMatch(HEX_RE);
        }
    });
});
