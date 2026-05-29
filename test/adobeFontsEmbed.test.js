import { describe, it, expect } from 'vitest';
import { parseAdobeFontsEmbed } from '@lib/adobeFontsEmbed';
describe('parseAdobeFontsEmbed', () => {
    it('parses a <link> tag', () => {
        const input = '<link rel="stylesheet" href="https://use.typekit.net/abc1def.css">';
        const result = parseAdobeFontsEmbed(input);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.kitId).toBe('abc1def');
            expect(result.value.url).toBe('https://use.typekit.net/abc1def.css');
        }
    });
    it('parses an @import url(...) snippet', () => {
        const input = "@import url('https://use.typekit.net/xyz789.css');";
        const result = parseAdobeFontsEmbed(input);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.kitId).toBe('xyz789');
        }
    });
    it('parses a bare URL', () => {
        const result = parseAdobeFontsEmbed('https://use.typekit.net/abc1def.css');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.kitId).toBe('abc1def');
        }
    });
    it('extracts kit IDs with mixed case + digits', () => {
        const result = parseAdobeFontsEmbed('https://use.typekit.net/AbCd1234.css');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.kitId).toBe('AbCd1234');
        }
    });
    it('drops fragment and stray query params on normalize', () => {
        const result = parseAdobeFontsEmbed('https://use.typekit.net/abc1def.css?display=swap#x');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.url).toBe('https://use.typekit.net/abc1def.css');
        }
    });
    it('rejects non-Typekit hosts', () => {
        const result = parseAdobeFontsEmbed('https://example.com/abc1def.css');
        expect(result.ok).toBe(false);
        if (!result.ok)
            expect(result.error).toContain('use.typekit.net');
    });
    it('rejects Google Fonts URLs (handled by the other parser)', () => {
        const result = parseAdobeFontsEmbed('https://fonts.googleapis.com/css2?family=Inter');
        expect(result.ok).toBe(false);
    });
    it('rejects the legacy JS embed form', () => {
        const result = parseAdobeFontsEmbed('<script src="https://use.typekit.net/abc1def.js"></script>');
        expect(result.ok).toBe(false);
    });
    it('rejects Typekit non-kit URLs', () => {
        const result = parseAdobeFontsEmbed('https://use.typekit.net/some/other/path.css');
        expect(result.ok).toBe(false);
    });
    it('rejects empty input', () => {
        expect(parseAdobeFontsEmbed('').ok).toBe(false);
        expect(parseAdobeFontsEmbed('   ').ok).toBe(false);
    });
    it('rejects malformed URLs', () => {
        expect(parseAdobeFontsEmbed('not a url').ok).toBe(false);
        expect(parseAdobeFontsEmbed('http://').ok).toBe(false);
    });
    it('tolerates surrounding whitespace', () => {
        const result = parseAdobeFontsEmbed('   https://use.typekit.net/abc1def.css  ');
        expect(result.ok).toBe(true);
    });
});
