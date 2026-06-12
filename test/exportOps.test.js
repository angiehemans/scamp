import { describe, it, expect } from 'vitest';
import { EXTENSION_FOR, sanitizeFilename, decodeDataUrl, } from '../src/main/ipc/exportOps';
describe('EXTENSION_FOR', () => {
    it('maps each export format to its file extension', () => {
        expect(EXTENSION_FOR.png).toBe('png');
        expect(EXTENSION_FOR.svg).toBe('svg');
    });
});
describe('sanitizeFilename', () => {
    it('strips path separators and reserved characters', () => {
        expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
    });
    it('trims surrounding whitespace', () => {
        expect(sanitizeFilename('  hero  ')).toBe('hero');
    });
    it('leaves a clean name untouched', () => {
        expect(sanitizeFilename('home-page')).toBe('home-page');
    });
});
describe('decodeDataUrl', () => {
    it('decodes the base64 payload of a data URL', () => {
        const dataUrl = `data:image/png;base64,${Buffer.from('hello').toString('base64')}`;
        expect(decodeDataUrl(dataUrl).toString('utf-8')).toBe('hello');
    });
    it('throws on a URL with no comma separator', () => {
        expect(() => decodeDataUrl('not-a-data-url')).toThrow('Malformed data URL');
    });
});
