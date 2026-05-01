import { describe, it, expect } from 'vitest';
import { formatTransitionShorthand, formatTransitionTime, parseTransitionSegment, parseTransitionShorthand, splitCssList, } from '@lib/parsers';
describe('splitCssList', () => {
    it('splits on top-level commas', () => {
        expect(splitCssList('a, b, c')).toEqual(['a', 'b', 'c']);
    });
    it('preserves commas inside parens', () => {
        expect(splitCssList('opacity 200ms ease, transform 300ms cubic-bezier(0.4, 0, 0.2, 1)')).toEqual([
            'opacity 200ms ease',
            'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        ]);
    });
    it('returns an empty array for empty input', () => {
        expect(splitCssList('')).toEqual([]);
        expect(splitCssList('   ')).toEqual([]);
    });
});
describe('parseTransitionSegment', () => {
    it('parses property + duration + easing + delay', () => {
        expect(parseTransitionSegment('opacity 200ms ease 100ms')).toEqual({
            property: 'opacity',
            durationMs: 200,
            easing: 'ease',
            delayMs: 100,
        });
    });
    it('treats the first time-value as duration and the second as delay', () => {
        expect(parseTransitionSegment('transform 0.3s ease-out 0.1s')).toEqual({
            property: 'transform',
            durationMs: 300,
            easing: 'ease-out',
            delayMs: 100,
        });
    });
    it('omits delay when only one time-value is present', () => {
        expect(parseTransitionSegment('color 0.5s linear')).toEqual({
            property: 'color',
            durationMs: 500,
            easing: 'linear',
            delayMs: 0,
        });
    });
    it('preserves cubic-bezier expressions verbatim', () => {
        expect(parseTransitionSegment('opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)')).toEqual({
            property: 'opacity',
            durationMs: 200,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            delayMs: 0,
        });
    });
    it('preserves steps() expressions verbatim', () => {
        expect(parseTransitionSegment('opacity 200ms steps(4, end)')).toEqual({
            property: 'opacity',
            durationMs: 200,
            easing: 'steps(4, end)',
            delayMs: 0,
        });
    });
    it('falls back to "all" when no property name is present', () => {
        expect(parseTransitionSegment('200ms ease')).toEqual({
            property: 'all',
            durationMs: 200,
            easing: 'ease',
            delayMs: 0,
        });
    });
    it('returns null for an empty segment', () => {
        expect(parseTransitionSegment('')).toBeNull();
        expect(parseTransitionSegment('   ')).toBeNull();
    });
    it('lowercases named easings but preserves cubic-bezier casing', () => {
        expect(parseTransitionSegment('opacity 200ms EASE-IN-OUT')?.easing).toBe('ease-in-out');
        expect(parseTransitionSegment('opacity 200ms CUBIC-BEZIER(0.1, 0.2, 0.3, 0.4)')
            ?.easing).toBe('CUBIC-BEZIER(0.1, 0.2, 0.3, 0.4)');
    });
});
describe('parseTransitionShorthand', () => {
    it('parses a single transition', () => {
        expect(parseTransitionShorthand('opacity 200ms ease')).toEqual([
            { property: 'opacity', durationMs: 200, easing: 'ease', delayMs: 0 },
        ]);
    });
    it('parses comma-separated transitions', () => {
        expect(parseTransitionShorthand('opacity 200ms ease, transform 300ms ease-in-out 100ms')).toEqual([
            { property: 'opacity', durationMs: 200, easing: 'ease', delayMs: 0 },
            {
                property: 'transform',
                durationMs: 300,
                easing: 'ease-in-out',
                delayMs: 100,
            },
        ]);
    });
    it('handles cubic-bezier without splitting on its inner commas', () => {
        expect(parseTransitionShorthand('opacity 200ms ease, transform 300ms cubic-bezier(0.4, 0, 0.2, 1) 50ms')).toEqual([
            { property: 'opacity', durationMs: 200, easing: 'ease', delayMs: 0 },
            {
                property: 'transform',
                durationMs: 300,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                delayMs: 50,
            },
        ]);
    });
    it('returns an empty list for empty input', () => {
        expect(parseTransitionShorthand('')).toEqual([]);
        expect(parseTransitionShorthand('  ')).toEqual([]);
    });
    it('returns an empty list for the explicit `none` keyword', () => {
        expect(parseTransitionShorthand('none')).toEqual([]);
    });
});
describe('formatTransitionTime', () => {
    it('renders 0 as "0ms"', () => {
        expect(formatTransitionTime(0)).toBe('0ms');
    });
    it('renders whole seconds in s', () => {
        expect(formatTransitionTime(1000)).toBe('1s');
        expect(formatTransitionTime(2000)).toBe('2s');
    });
    it('renders sub-second / non-whole-second values in ms', () => {
        expect(formatTransitionTime(200)).toBe('200ms');
        expect(formatTransitionTime(1500)).toBe('1500ms');
    });
});
describe('formatTransitionShorthand', () => {
    it('returns an empty string for an empty list', () => {
        expect(formatTransitionShorthand([])).toBe('');
    });
    it('omits the delay segment when delayMs is zero', () => {
        const t = {
            property: 'opacity',
            durationMs: 200,
            easing: 'ease',
            delayMs: 0,
        };
        expect(formatTransitionShorthand([t])).toBe('opacity 200ms ease');
    });
    it('emits the delay segment when non-zero', () => {
        const t = {
            property: 'transform',
            durationMs: 300,
            easing: 'ease-in-out',
            delayMs: 100,
        };
        expect(formatTransitionShorthand([t])).toBe('transform 300ms ease-in-out 100ms');
    });
    it('joins multiple transitions with commas', () => {
        const ts = [
            { property: 'opacity', durationMs: 200, easing: 'ease', delayMs: 0 },
            { property: 'transform', durationMs: 300, easing: 'linear', delayMs: 0 },
        ];
        expect(formatTransitionShorthand(ts)).toBe('opacity 200ms ease, transform 300ms linear');
    });
});
describe('round-trip parse → format → parse', () => {
    it('reproduces the input list exactly', () => {
        const original = [
            { property: 'opacity', durationMs: 200, easing: 'ease', delayMs: 0 },
            {
                property: 'transform',
                durationMs: 300,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                delayMs: 100,
            },
        ];
        const css = formatTransitionShorthand(original);
        const back = parseTransitionShorthand(css);
        expect(back).toEqual(original);
    });
});
