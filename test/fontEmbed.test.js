import { describe, it, expect } from 'vitest';
import { parseFontEmbed } from '@lib/fontEmbed';
describe('parseFontEmbed', () => {
    it('routes Google Fonts snippets to the google branch', () => {
        const result = parseFontEmbed('<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.provider).toBe('google');
            if (result.provider === 'google') {
                expect(result.families).toEqual(['Inter']);
            }
        }
    });
    it('routes Adobe Fonts snippets to the adobe branch', () => {
        const result = parseFontEmbed('https://use.typekit.net/abc1def.css');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.provider).toBe('adobe');
            if (result.provider === 'adobe') {
                expect(result.kitId).toBe('abc1def');
            }
        }
    });
    it('returns an error mentioning both providers for unrecognized input', () => {
        const result = parseFontEmbed('https://example.com/font.css');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('Google');
            expect(result.error).toContain('Adobe');
        }
    });
    it('returns an error mentioning both providers for empty input', () => {
        const result = parseFontEmbed('   ');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('Google');
            expect(result.error).toContain('Adobe');
        }
    });
    it('accepts @import url() forms from both providers', () => {
        const google = parseFontEmbed("@import url('https://fonts.googleapis.com/css2?family=Roboto');");
        expect(google.ok).toBe(true);
        if (google.ok)
            expect(google.provider).toBe('google');
        const adobe = parseFontEmbed("@import url('https://use.typekit.net/xyz.css');");
        expect(adobe.ok).toBe(true);
        if (adobe.ok)
            expect(adobe.provider).toBe('adobe');
    });
});
