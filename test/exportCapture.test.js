import { describe, it, expect } from 'vitest';
import { sanitizeExportFilename, suggestExportFilename, } from '@renderer/src/lib/exportCapture';
describe('sanitizeExportFilename', () => {
    it('strips path separators and shell-hostile characters', () => {
        expect(sanitizeExportFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
    });
    it('keeps spaces and dashes intact', () => {
        expect(sanitizeExportFilename('hero card-1')).toBe('hero card-1');
    });
    it('falls back to "export" for an empty result', () => {
        expect(sanitizeExportFilename('')).toBe('export');
        expect(sanitizeExportFilename('   ')).toBe('export');
        expect(sanitizeExportFilename('////')).toBe('export');
    });
});
describe('suggestExportFilename', () => {
    it('mirrors sanitizeExportFilename for valid inputs', () => {
        expect(suggestExportFilename('home')).toBe('home');
        expect(suggestExportFilename('rect_a1b2')).toBe('rect_a1b2');
    });
});
