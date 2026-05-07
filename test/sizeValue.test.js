import { describe, it, expect } from 'vitest';
import { formatSizeValue, parseSizeValue, } from '@lib/parsers';
describe('parseSizeValue', () => {
    describe('mode keywords', () => {
        it('"100%" → stretch', () => {
            expect(parseSizeValue('100%')).toEqual({
                mode: 'stretch',
                value: 0,
                custom: undefined,
            });
        });
        it('"auto" → auto', () => {
            expect(parseSizeValue('auto')).toEqual({
                mode: 'auto',
                value: 0,
                custom: undefined,
            });
        });
        it('"fit-content" → fit-content', () => {
            expect(parseSizeValue('fit-content')).toEqual({
                mode: 'fit-content',
                value: 0,
                custom: undefined,
            });
        });
        it('keywords are case-insensitive', () => {
            expect(parseSizeValue('AUTO').mode).toBe('auto');
            expect(parseSizeValue('Fit-Content').mode).toBe('fit-content');
        });
    });
    describe('plain px', () => {
        it('"100" (no unit) → fixed-px 100, no custom', () => {
            expect(parseSizeValue('100')).toEqual({
                mode: 'fixed',
                value: 100,
                custom: undefined,
            });
        });
        it('"100px" → fixed-px 100, no custom', () => {
            expect(parseSizeValue('100px')).toEqual({
                mode: 'fixed',
                value: 100,
                custom: undefined,
            });
        });
        it('"100PX" (caps) is accepted', () => {
            expect(parseSizeValue('100PX').mode).toBe('fixed');
            expect(parseSizeValue('100PX').custom).toBeUndefined();
        });
        it('rounds fractional px', () => {
            expect(parseSizeValue('100.5px').value).toBe(101);
        });
        it('"0" / "0px" → fixed 0', () => {
            expect(parseSizeValue('0').value).toBe(0);
            expect(parseSizeValue('0px').value).toBe(0);
        });
    });
    describe('non-px lengths preserved verbatim', () => {
        it('"100vh" → fixed with custom and best-effort numeric', () => {
            expect(parseSizeValue('100vh')).toEqual({
                mode: 'fixed',
                value: 100,
                custom: '100vh',
            });
        });
        it('"50vw" → fixed with custom', () => {
            expect(parseSizeValue('50vw')).toEqual({
                mode: 'fixed',
                value: 50,
                custom: '50vw',
            });
        });
        it('"2em" → fixed with custom', () => {
            expect(parseSizeValue('2em')).toEqual({
                mode: 'fixed',
                value: 2,
                custom: '2em',
            });
        });
        it('"calc(100% - 20px)" → fixed, value falls back to 0', () => {
            expect(parseSizeValue('calc(100% - 20px)')).toEqual({
                mode: 'fixed',
                value: 0,
                custom: 'calc(100% - 20px)',
            });
        });
        it('"var(--w)" → fixed, value falls back to 0', () => {
            expect(parseSizeValue('var(--w)')).toEqual({
                mode: 'fixed',
                value: 0,
                custom: 'var(--w)',
            });
        });
        it('partial-percent like "50%" → fixed with custom (only literal "100%" is stretch)', () => {
            expect(parseSizeValue('50%')).toEqual({
                mode: 'fixed',
                value: 50,
                custom: '50%',
            });
        });
    });
    describe('empty / whitespace', () => {
        it('"" → auto', () => {
            expect(parseSizeValue('').mode).toBe('auto');
        });
        it('whitespace → auto', () => {
            expect(parseSizeValue('   ').mode).toBe('auto');
        });
    });
});
describe('formatSizeValue', () => {
    it('fixed + no custom → `Npx`', () => {
        expect(formatSizeValue('fixed', 100, undefined)).toBe('100px');
    });
    it('fixed + custom → custom verbatim', () => {
        expect(formatSizeValue('fixed', 100, '100vh')).toBe('100vh');
        expect(formatSizeValue('fixed', 0, 'calc(100% - 20px)')).toBe('calc(100% - 20px)');
    });
    it('stretch → "100%"', () => {
        expect(formatSizeValue('stretch', 0, undefined)).toBe('100%');
    });
    it('fit-content → "fit-content"', () => {
        expect(formatSizeValue('fit-content', 0, undefined)).toBe('fit-content');
    });
    it('auto → "auto"', () => {
        expect(formatSizeValue('auto', 0, undefined)).toBe('auto');
    });
    it('empty-string custom is treated as no-custom', () => {
        expect(formatSizeValue('fixed', 100, '')).toBe('100px');
    });
});
describe('parseSizeValue + formatSizeValue round-trip', () => {
    const cases = [
        '100px',
        '100vh',
        '100vw',
        '2em',
        '0.5rem',
        'calc(100% - 20px)',
        'var(--page-h)',
        '100%',
        'auto',
        'fit-content',
    ];
    for (const input of cases) {
        it(`round-trips "${input}"`, () => {
            const parsed = parseSizeValue(input);
            const formatted = formatSizeValue(parsed.mode, parsed.value, parsed.custom);
            // Plain numbers ("100") become "100px" on format — by design,
            // since the bare-number sugar is an input-side affordance.
            // For `2em` etc we expect verbatim.
            if (input === '100') {
                expect(formatted).toBe('100px');
            }
            else {
                expect(formatted).toBe(input);
            }
        });
    }
    it('normalises "100" (no unit) to "100px" on format', () => {
        const parsed = parseSizeValue('100');
        expect(formatSizeValue(parsed.mode, parsed.value, parsed.custom)).toBe('100px');
    });
});
