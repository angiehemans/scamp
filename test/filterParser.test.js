import { describe, it, expect } from 'vitest';
import { formatFilterList, parseFilterFunction, parseFilterList, } from '@lib/parsers';
describe('parseFilterFunction', () => {
    it('parses blur with px', () => {
        expect(parseFilterFunction('blur(8px)')).toEqual({
            kind: 'blur',
            value: 8,
        });
    });
    it('parses blur with unitless zero (length is unambiguous at zero)', () => {
        expect(parseFilterFunction('blur(0)')).toEqual({
            kind: 'blur',
            value: 0,
        });
    });
    it('parses brightness with %', () => {
        expect(parseFilterFunction('brightness(120%)')).toEqual({
            kind: 'brightness',
            value: 120,
        });
    });
    it('parses contrast with %', () => {
        expect(parseFilterFunction('contrast(80%)')).toEqual({
            kind: 'contrast',
            value: 80,
        });
    });
    it('parses grayscale with %', () => {
        expect(parseFilterFunction('grayscale(100%)')).toEqual({
            kind: 'grayscale',
            value: 100,
        });
    });
    it('parses hue-rotate with deg', () => {
        expect(parseFilterFunction('hue-rotate(90deg)')).toEqual({
            kind: 'hue-rotate',
            value: 90,
        });
    });
    it('parses invert with %', () => {
        expect(parseFilterFunction('invert(100%)')).toEqual({
            kind: 'invert',
            value: 100,
        });
    });
    it('parses opacity (filter) with %', () => {
        expect(parseFilterFunction('opacity(50%)')).toEqual({
            kind: 'opacity',
            value: 50,
        });
    });
    it('parses saturate with %', () => {
        expect(parseFilterFunction('saturate(150%)')).toEqual({
            kind: 'saturate',
            value: 150,
        });
    });
    it('parses sepia with %', () => {
        expect(parseFilterFunction('sepia(80%)')).toEqual({
            kind: 'sepia',
            value: 80,
        });
    });
    it('parses the kind case-insensitively', () => {
        expect(parseFilterFunction('BLUR(4px)')).toEqual({
            kind: 'blur',
            value: 4,
        });
        expect(parseFilterFunction('Hue-Rotate(45deg)')).toEqual({
            kind: 'hue-rotate',
            value: 45,
        });
    });
    it('parses decimal values', () => {
        expect(parseFilterFunction('blur(2.5px)')).toEqual({
            kind: 'blur',
            value: 2.5,
        });
    });
    it('returns null for an unknown function name', () => {
        expect(parseFilterFunction('drop-shadow(0 4px 8px #000)')).toBeNull();
    });
    it('returns null when the unit mismatches the kind', () => {
        expect(parseFilterFunction('blur(50%)')).toBeNull();
        expect(parseFilterFunction('brightness(2px)')).toBeNull();
        expect(parseFilterFunction('hue-rotate(50%)')).toBeNull();
    });
    it('returns null for unitless decimal arguments (we only model percent form)', () => {
        expect(parseFilterFunction('brightness(1.2)')).toBeNull();
        expect(parseFilterFunction('saturate(2)')).toBeNull();
        expect(parseFilterFunction('opacity(0.5)')).toBeNull();
    });
    it('returns null for nested parens (var, calc)', () => {
        expect(parseFilterFunction('blur(var(--md))')).toBeNull();
        expect(parseFilterFunction('brightness(calc(100% + 20%))')).toBeNull();
    });
    it('returns null for empty argument', () => {
        expect(parseFilterFunction('blur()')).toBeNull();
    });
    it('returns null for empty input', () => {
        expect(parseFilterFunction('')).toBeNull();
    });
    it('returns null for a bare keyword (no function call)', () => {
        expect(parseFilterFunction('blur')).toBeNull();
        expect(parseFilterFunction('inherit')).toBeNull();
    });
});
describe('parseFilterList', () => {
    it('returns [] for none', () => {
        expect(parseFilterList('none')).toEqual([]);
    });
    it('returns [] for empty input', () => {
        expect(parseFilterList('')).toEqual([]);
        expect(parseFilterList('   ')).toEqual([]);
    });
    it('parses a single filter', () => {
        expect(parseFilterList('blur(8px)')).toEqual([
            { kind: 'blur', value: 8 },
        ]);
    });
    it('parses a multi-filter list space-separated', () => {
        expect(parseFilterList('blur(4px) brightness(120%) grayscale(20%)')).toEqual([
            { kind: 'blur', value: 4 },
            { kind: 'brightness', value: 120 },
            { kind: 'grayscale', value: 20 },
        ]);
    });
    it('preserves order across multiple filters', () => {
        expect(parseFilterList('hue-rotate(90deg) blur(2px)')).toEqual([
            { kind: 'hue-rotate', value: 90 },
            { kind: 'blur', value: 2 },
        ]);
    });
    it('returns null when ANY function fails (no silent drops)', () => {
        expect(parseFilterList('blur(4px) drop-shadow(0 0 0)')).toBeNull();
        expect(parseFilterList('brightness(120%) blur(var(--md))')).toBeNull();
    });
    it('returns null for inherit / initial / unset / revert', () => {
        expect(parseFilterList('inherit')).toBeNull();
        expect(parseFilterList('initial')).toBeNull();
        expect(parseFilterList('unset')).toBeNull();
        expect(parseFilterList('revert')).toBeNull();
    });
    it('handles extra whitespace between filters', () => {
        expect(parseFilterList('  blur(4px)    brightness(120%)  ')).toEqual([
            { kind: 'blur', value: 4 },
            { kind: 'brightness', value: 120 },
        ]);
    });
});
describe('formatFilterList', () => {
    it('returns empty string for an empty list', () => {
        expect(formatFilterList([])).toBe('');
    });
    it('emits a single filter with its canonical unit', () => {
        expect(formatFilterList([{ kind: 'blur', value: 8 }])).toBe('blur(8px)');
        expect(formatFilterList([{ kind: 'brightness', value: 120 }])).toBe('brightness(120%)');
        expect(formatFilterList([{ kind: 'hue-rotate', value: 90 }])).toBe('hue-rotate(90deg)');
    });
    it('joins multiple filters with a space', () => {
        expect(formatFilterList([
            { kind: 'blur', value: 4 },
            { kind: 'brightness', value: 120 },
            { kind: 'grayscale', value: 20 },
        ])).toBe('blur(4px) brightness(120%) grayscale(20%)');
    });
    it('omits trailing-zero decimals', () => {
        expect(formatFilterList([{ kind: 'blur', value: 8.0 }])).toBe('blur(8px)');
        expect(formatFilterList([{ kind: 'brightness', value: 120.5 }])).toBe('brightness(120.5%)');
    });
    it('preserves order', () => {
        expect(formatFilterList([
            { kind: 'sepia', value: 100 },
            { kind: 'blur', value: 2 },
        ])).toBe('sepia(100%) blur(2px)');
    });
});
describe('parseFilter round-trip', () => {
    const ROUND_TRIP_CASES = [
        { kind: 'blur', value: 4 },
        { kind: 'brightness', value: 120 },
        { kind: 'contrast', value: 80 },
        { kind: 'grayscale', value: 50 },
        { kind: 'hue-rotate', value: 90 },
        { kind: 'invert', value: 100 },
        { kind: 'opacity', value: 50 },
        { kind: 'saturate', value: 150 },
        { kind: 'sepia', value: 80 },
    ];
    for (const filter of ROUND_TRIP_CASES) {
        it(`round-trips ${filter.kind}(${filter.value})`, () => {
            const formatted = formatFilterList([filter]);
            const parsed = parseFilterList(formatted);
            expect(parsed).toEqual([filter]);
        });
    }
    it('round-trips a multi-filter list', () => {
        const formatted = formatFilterList(ROUND_TRIP_CASES);
        const parsed = parseFilterList(formatted);
        expect(parsed).toEqual(ROUND_TRIP_CASES);
    });
});
