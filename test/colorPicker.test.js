import { describe, it, expect } from 'vitest';
import { expandHexShorthand } from '../src/renderer/src/components/controls/colorUtils';
describe('expandHexShorthand', () => {
    it('expands #rgb to #rrggbb', () => {
        expect(expandHexShorthand('#abc')).toBe('#aabbcc');
    });
    it('expands #FFF to #ffffff and lowercases', () => {
        expect(expandHexShorthand('#FFF')).toBe('#ffffff');
    });
    it('expands #FfA to #ffffaa', () => {
        expect(expandHexShorthand('#FfA')).toBe('#ffffaa');
    });
    it('leaves a full 6-digit hex unchanged', () => {
        expect(expandHexShorthand('#aabbcc')).toBe('#aabbcc');
    });
    it('preserves case on full 6-digit hex (does not lowercase)', () => {
        // Non-shorthand hex bypasses the expansion path entirely.
        expect(expandHexShorthand('#AaBbCc')).toBe('#AaBbCc');
    });
    it('leaves rgba(...) unchanged', () => {
        expect(expandHexShorthand('rgba(0, 0, 0, 0.5)')).toBe('rgba(0, 0, 0, 0.5)');
    });
    it('leaves var(--accent) unchanged', () => {
        expect(expandHexShorthand('var(--accent)')).toBe('var(--accent)');
    });
    it('leaves named colors unchanged', () => {
        expect(expandHexShorthand('currentColor')).toBe('currentColor');
        expect(expandHexShorthand('transparent')).toBe('transparent');
    });
    it('trims whitespace before checking', () => {
        expect(expandHexShorthand('  #abc  ')).toBe('#aabbcc');
    });
    it('leaves a 4-character "shorthand-ish" string unchanged', () => {
        // #abcd is not a valid 3-digit shorthand — leave it alone.
        expect(expandHexShorthand('#abcd')).toBe('#abcd');
    });
    it('leaves an empty string as empty', () => {
        expect(expandHexShorthand('')).toBe('');
    });
});
