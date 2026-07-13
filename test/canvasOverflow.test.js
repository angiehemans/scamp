import { describe, it, expect } from 'vitest';
import { formatOverflowLabel, overflowExtent, } from '../src/renderer/lib/canvasOverflow';
describe('overflowExtent', () => {
    it('returns the positive difference when content overflows', () => {
        expect(overflowExtent(1680, 1440)).toBe(240);
    });
    it('returns 0 when content fits exactly', () => {
        expect(overflowExtent(1440, 1440)).toBe(0);
    });
    it('clamps to 0 when the scroll size is smaller than the client', () => {
        expect(overflowExtent(1200, 1440)).toBe(0);
    });
    it('rounds sub-pixel measurements to whole pixels', () => {
        expect(overflowExtent(1440.4, 1200.1)).toBe(240);
    });
});
describe('formatOverflowLabel', () => {
    it('formats a positive overflow', () => {
        expect(formatOverflowLabel(240)).toBe('+ 240px overflow');
    });
    it('returns an empty string for no overflow', () => {
        expect(formatOverflowLabel(0)).toBe('');
        expect(formatOverflowLabel(-10)).toBe('');
    });
});
