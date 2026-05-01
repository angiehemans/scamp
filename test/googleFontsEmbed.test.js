import { describe, it, expect } from 'vitest';
import { parseGoogleFontsEmbed } from '@lib/googleFontsEmbed';
describe('parseGoogleFontsEmbed', () => {
    it('parses a <link> tag', () => {
        const input = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap" rel="stylesheet">';
        const result = parseGoogleFontsEmbed(input);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.families).toEqual(['Inter']);
            expect(result.value.url).toContain('family=Inter');
        }
    });
    it('parses an @import url(...) snippet', () => {
        const input = "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap');";
        const result = parseGoogleFontsEmbed(input);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.families).toEqual(['Playfair Display']);
        }
    });
    it('parses a bare URL', () => {
        const input = 'https://fonts.googleapis.com/css2?family=Inter&display=swap';
        const result = parseGoogleFontsEmbed(input);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.families).toEqual(['Inter']);
        }
    });
    it('parses multi-family URLs', () => {
        const input = 'https://fonts.googleapis.com/css2?family=Inter&family=Playfair+Display&display=swap';
        const result = parseGoogleFontsEmbed(input);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.families).toEqual(['Inter', 'Playfair Display']);
        }
    });
    it('strips weight axis specs from family names', () => {
        const input = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400..700&display=swap';
        const result = parseGoogleFontsEmbed(input);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.families).toEqual(['Inter Tight']);
        }
    });
    it('dedupes repeated families', () => {
        const input = 'https://fonts.googleapis.com/css2?family=Inter&family=Inter&display=swap';
        const result = parseGoogleFontsEmbed(input);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.families).toEqual(['Inter']);
        }
    });
    it('supports the legacy /css path', () => {
        const input = 'https://fonts.googleapis.com/css?family=Roboto';
        const result = parseGoogleFontsEmbed(input);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.families).toEqual(['Roboto']);
        }
    });
    it('rejects non-Google hosts', () => {
        const result = parseGoogleFontsEmbed('https://example.com/css?family=Inter');
        expect(result.ok).toBe(false);
        if (!result.ok)
            expect(result.error).toContain('fonts.googleapis.com');
    });
    it('rejects Google URLs that are not /css or /css2', () => {
        const result = parseGoogleFontsEmbed('https://fonts.googleapis.com/icon?family=Material+Icons');
        expect(result.ok).toBe(false);
    });
    it('rejects empty input', () => {
        expect(parseGoogleFontsEmbed('').ok).toBe(false);
        expect(parseGoogleFontsEmbed('   ').ok).toBe(false);
    });
    it('rejects URLs missing a family parameter', () => {
        const result = parseGoogleFontsEmbed('https://fonts.googleapis.com/css2?display=swap');
        expect(result.ok).toBe(false);
    });
    it('rejects malformed URLs', () => {
        expect(parseGoogleFontsEmbed('not a url').ok).toBe(false);
        expect(parseGoogleFontsEmbed('http://').ok).toBe(false);
    });
    it('tolerates surrounding whitespace', () => {
        const result = parseGoogleFontsEmbed('   https://fonts.googleapis.com/css2?family=Inter  ');
        expect(result.ok).toBe(true);
    });
});
