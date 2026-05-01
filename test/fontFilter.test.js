import { describe, it, expect } from 'vitest';
import { filterFonts } from '@renderer/lib/fontFilter';
const SAMPLE = [
    'Arial',
    'Comic Sans MS',
    'Courier New',
    'Helvetica',
    'Helvetica Neue',
    'Inter',
    'Menlo',
    'Times New Roman',
];
describe('filterFonts', () => {
    it('returns the full list for an empty query', () => {
        expect(filterFonts(SAMPLE, '')).toEqual(SAMPLE);
        expect(filterFonts(SAMPLE, '   ')).toEqual(SAMPLE);
    });
    it('ranks prefix matches above substring matches', () => {
        const result = filterFonts(SAMPLE, 'hel');
        // Both Helvetica and Helvetica Neue start with "hel" — they come first.
        // No substring match in the sample for "hel", so the result is just
        // those two.
        expect(result).toEqual(['Helvetica', 'Helvetica Neue']);
    });
    it('falls back to substring matches when nothing starts with the query', () => {
        const result = filterFonts(SAMPLE, 'new');
        expect(result).toEqual(['Courier New', 'Times New Roman']);
    });
    it('combines prefix + substring results in that order', () => {
        const result = filterFonts(SAMPLE, 'co');
        // "Comic Sans MS" and "Courier New" both start with "co"; nothing
        // else contains "co".
        expect(result).toEqual(['Comic Sans MS', 'Courier New']);
    });
    it('mixes prefix and substring matches', () => {
        // "Inter" starts with "i"; "Comic" contains "i" but doesn't start
        // with it.
        const result = filterFonts(['Arial', 'Comic', 'Inter'], 'i');
        expect(result[0]).toBe('Inter');
        expect(result).toEqual(['Inter', 'Arial', 'Comic']);
    });
    it('is case-insensitive', () => {
        expect(filterFonts(SAMPLE, 'HELVETICA')).toEqual([
            'Helvetica',
            'Helvetica Neue',
        ]);
        expect(filterFonts(SAMPLE, 'helvetica')).toEqual([
            'Helvetica',
            'Helvetica Neue',
        ]);
    });
    it('returns an empty list when nothing matches', () => {
        expect(filterFonts(SAMPLE, 'xyz')).toEqual([]);
    });
    it('preserves the source order within each rank group (stable)', () => {
        const fonts = ['Beta', 'Alpha', 'Gamma', 'Alphabet'];
        // Both Alpha and Alphabet start with "al"; source order puts
        // "Alpha" after "Beta" but before "Gamma/Alphabet" — stable sort
        // preserves the source order of prefix matches.
        expect(filterFonts(fonts, 'al')).toEqual(['Alpha', 'Alphabet']);
    });
});
