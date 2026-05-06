import { describe, it, expect } from 'vitest';
import { formatBoxShadowShorthand, parseBoxShadowSegment, parseBoxShadowShorthand, tokenizeShorthandSegment, } from '@lib/parsers';
describe('tokenizeShorthandSegment', () => {
    it('splits on whitespace at the top level', () => {
        expect(tokenizeShorthandSegment('0 4px 8px')).toEqual(['0', '4px', '8px']);
    });
    it('keeps parenthesised function calls intact', () => {
        expect(tokenizeShorthandSegment('0 4px 8px rgba(0, 0, 0, 0.15)')).toEqual([
            '0',
            '4px',
            '8px',
            'rgba(0, 0, 0, 0.15)',
        ]);
    });
    it('keeps nested cubic-bezier intact', () => {
        expect(tokenizeShorthandSegment('opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)')).toEqual(['opacity', '200ms', 'cubic-bezier(0.4, 0, 0.2, 1)']);
    });
    it('returns an empty array for empty input', () => {
        expect(tokenizeShorthandSegment('')).toEqual([]);
        expect(tokenizeShorthandSegment('   ')).toEqual([]);
    });
});
describe('parseBoxShadowSegment', () => {
    it('parses 4 lengths + rgba color', () => {
        expect(parseBoxShadowSegment('0 4px 8px 0 rgba(0, 0, 0, 0.15)')).toEqual({
            offsetX: 0,
            offsetY: 4,
            blur: 8,
            spread: 0,
            color: 'rgba(0, 0, 0, 0.15)',
            inset: false,
        });
    });
    it('parses 2 lengths — blur and spread default to 0', () => {
        expect(parseBoxShadowSegment('4px 4px')).toEqual({
            offsetX: 4,
            offsetY: 4,
            blur: 0,
            spread: 0,
            color: 'currentColor',
            inset: false,
        });
    });
    it('parses 3 lengths — spread defaults to 0', () => {
        expect(parseBoxShadowSegment('0 4px 8px')).toEqual({
            offsetX: 0,
            offsetY: 4,
            blur: 8,
            spread: 0,
            color: 'currentColor',
            inset: false,
        });
    });
    it('parses leading inset', () => {
        expect(parseBoxShadowSegment('inset 0 4px 8px rgba(0, 0, 0, 0.5)')).toEqual({
            offsetX: 0,
            offsetY: 4,
            blur: 8,
            spread: 0,
            color: 'rgba(0, 0, 0, 0.5)',
            inset: true,
        });
    });
    it('parses trailing inset', () => {
        expect(parseBoxShadowSegment('0 4px 8px rgba(0, 0, 0, 0.5) inset')).toEqual({
            offsetX: 0,
            offsetY: 4,
            blur: 8,
            spread: 0,
            color: 'rgba(0, 0, 0, 0.5)',
            inset: true,
        });
    });
    it('parses negative offsets', () => {
        expect(parseBoxShadowSegment('-4px -4px 8px #000')).toEqual({
            offsetX: -4,
            offsetY: -4,
            blur: 8,
            spread: 0,
            color: '#000',
            inset: false,
        });
    });
    it('parses negative spread', () => {
        expect(parseBoxShadowSegment('0 4px 8px -2px #000')).toEqual({
            offsetX: 0,
            offsetY: 4,
            blur: 8,
            spread: -2,
            color: '#000',
            inset: false,
        });
    });
    it('parses hex color first', () => {
        expect(parseBoxShadowSegment('#000 0 4px 8px')).toEqual({
            offsetX: 0,
            offsetY: 4,
            blur: 8,
            spread: 0,
            color: '#000',
            inset: false,
        });
    });
    it('parses hex color last', () => {
        expect(parseBoxShadowSegment('0 4px 8px #000')).toEqual({
            offsetX: 0,
            offsetY: 4,
            blur: 8,
            spread: 0,
            color: '#000',
            inset: false,
        });
    });
    it('omits color → defaults to currentColor', () => {
        expect(parseBoxShadowSegment('0 4px 8px')).toEqual({
            offsetX: 0,
            offsetY: 4,
            blur: 8,
            spread: 0,
            color: 'currentColor',
            inset: false,
        });
    });
    it('returns null for a calc() length', () => {
        expect(parseBoxShadowSegment('0 calc(4px + 1vw) 8px')).toBeNull();
    });
    it('returns null for a single token (only one length)', () => {
        expect(parseBoxShadowSegment('4px')).toBeNull();
    });
    it('returns null for a token-only shadow (no lengths)', () => {
        expect(parseBoxShadowSegment('var(--shadow-md)')).toBeNull();
    });
    it('returns null for empty input', () => {
        expect(parseBoxShadowSegment('')).toBeNull();
    });
    it('returns null when two non-length tokens sit alongside', () => {
        // Two color-shaped tokens → ambiguous, refuse rather than guess.
        expect(parseBoxShadowSegment('#000 4px 4px red')).toBeNull();
    });
    it('returns null when inset appears twice', () => {
        expect(parseBoxShadowSegment('inset inset 4px 4px')).toBeNull();
    });
});
describe('parseBoxShadowShorthand', () => {
    it('returns [] for none', () => {
        expect(parseBoxShadowShorthand('none')).toEqual([]);
    });
    it('returns [] for empty input', () => {
        expect(parseBoxShadowShorthand('')).toEqual([]);
        expect(parseBoxShadowShorthand('   ')).toEqual([]);
    });
    it('parses a single shadow', () => {
        expect(parseBoxShadowShorthand('0 4px 8px 0 rgba(0, 0, 0, 0.15)')).toEqual([
            {
                offsetX: 0,
                offsetY: 4,
                blur: 8,
                spread: 0,
                color: 'rgba(0, 0, 0, 0.15)',
                inset: false,
            },
        ]);
    });
    it('parses a multi-shadow list and preserves order', () => {
        expect(parseBoxShadowShorthand('0 4px 8px 0 rgba(0, 0, 0, 0.15), 0 1px 2px 0 rgba(0, 0, 0, 0.08)')).toEqual([
            {
                offsetX: 0,
                offsetY: 4,
                blur: 8,
                spread: 0,
                color: 'rgba(0, 0, 0, 0.15)',
                inset: false,
            },
            {
                offsetX: 0,
                offsetY: 1,
                blur: 2,
                spread: 0,
                color: 'rgba(0, 0, 0, 0.08)',
                inset: false,
            },
        ]);
    });
    it('preserves rgba commas inside parens', () => {
        const out = parseBoxShadowShorthand('0 4px 8px hsl(0, 0%, 0%)');
        expect(out).toEqual([
            {
                offsetX: 0,
                offsetY: 4,
                blur: 8,
                spread: 0,
                color: 'hsl(0, 0%, 0%)',
                inset: false,
            },
        ]);
    });
    it('returns null when ANY segment fails (no silent drops)', () => {
        expect(parseBoxShadowShorthand('0 4px 8px 0 #000, var(--shadow-md)')).toBeNull();
    });
    it('returns null for inherit / initial / unset', () => {
        expect(parseBoxShadowShorthand('inherit')).toBeNull();
        expect(parseBoxShadowShorthand('initial')).toBeNull();
        expect(parseBoxShadowShorthand('unset')).toBeNull();
    });
    it('mixes inset and non-inset shadows in one list', () => {
        expect(parseBoxShadowShorthand('0 4px 8px #000, inset 0 0 0 1px #ffffff')).toEqual([
            {
                offsetX: 0,
                offsetY: 4,
                blur: 8,
                spread: 0,
                color: '#000',
                inset: false,
            },
            {
                offsetX: 0,
                offsetY: 0,
                blur: 0,
                spread: 1,
                color: '#ffffff',
                inset: true,
            },
        ]);
    });
});
describe('formatBoxShadowShorthand', () => {
    it('returns empty string for an empty list', () => {
        expect(formatBoxShadowShorthand([])).toBe('');
    });
    it('emits offsets + blur + color (omits 0 spread)', () => {
        expect(formatBoxShadowShorthand([
            {
                offsetX: 0,
                offsetY: 4,
                blur: 8,
                spread: 0,
                color: 'rgba(0, 0, 0, 0.15)',
                inset: false,
            },
        ])).toBe('0px 4px 8px rgba(0, 0, 0, 0.15)');
    });
    it('emits leading inset for inset shadows', () => {
        expect(formatBoxShadowShorthand([
            {
                offsetX: 0,
                offsetY: 0,
                blur: 0,
                spread: 1,
                color: '#ffffff',
                inset: true,
            },
        ])).toBe('inset 0px 0px 0px 1px #ffffff');
    });
    it('emits non-zero spread', () => {
        expect(formatBoxShadowShorthand([
            {
                offsetX: 0,
                offsetY: 4,
                blur: 8,
                spread: -2,
                color: '#000',
                inset: false,
            },
        ])).toBe('0px 4px 8px -2px #000');
    });
    it('omits color when it is the default currentColor', () => {
        expect(formatBoxShadowShorthand([
            {
                offsetX: 0,
                offsetY: 4,
                blur: 8,
                spread: 0,
                color: 'currentColor',
                inset: false,
            },
        ])).toBe('0px 4px 8px');
    });
    it('joins multiple shadows with ", "', () => {
        expect(formatBoxShadowShorthand([
            {
                offsetX: 0,
                offsetY: 4,
                blur: 8,
                spread: 0,
                color: 'rgba(0, 0, 0, 0.15)',
                inset: false,
            },
            {
                offsetX: 0,
                offsetY: 1,
                blur: 2,
                spread: 0,
                color: 'rgba(0, 0, 0, 0.08)',
                inset: false,
            },
        ])).toBe('0px 4px 8px rgba(0, 0, 0, 0.15), 0px 1px 2px rgba(0, 0, 0, 0.08)');
    });
});
describe('parseBoxShadow round-trip', () => {
    const ROUND_TRIP_CASES = [
        {
            offsetX: 0,
            offsetY: 4,
            blur: 8,
            spread: 0,
            color: 'rgba(0, 0, 0, 0.15)',
            inset: false,
        },
        {
            offsetX: -2,
            offsetY: -2,
            blur: 4,
            spread: 1,
            color: '#000000',
            inset: false,
        },
        {
            offsetX: 0,
            offsetY: 0,
            blur: 0,
            spread: 1,
            color: '#ffffff',
            inset: true,
        },
    ];
    for (const shadow of ROUND_TRIP_CASES) {
        it(`round-trips ${JSON.stringify(shadow)}`, () => {
            const formatted = formatBoxShadowShorthand([shadow]);
            const parsed = parseBoxShadowShorthand(formatted);
            expect(parsed).toEqual([shadow]);
        });
    }
    it('round-trips a multi-shadow list', () => {
        const formatted = formatBoxShadowShorthand(ROUND_TRIP_CASES);
        const parsed = parseBoxShadowShorthand(formatted);
        expect(parsed).toEqual(ROUND_TRIP_CASES);
    });
});
