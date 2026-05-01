import { describe, it, expect } from 'vitest';
import { formatAnimationShorthand, parseAnimationShorthand, } from '@lib/parsers';
const baseDefaults = {
    easing: 'ease',
    delayMs: 0,
    iterationCount: 1,
    direction: 'normal',
    fillMode: 'none',
    playState: 'running',
};
describe('parseAnimationShorthand', () => {
    it('parses a minimal name + duration', () => {
        expect(parseAnimationShorthand('fade-in 300ms')).toEqual({
            ...baseDefaults,
            name: 'fade-in',
            isPreset: true,
            durationMs: 300,
        });
    });
    it('parses the full canonical shorthand', () => {
        expect(parseAnimationShorthand('fade-in-up 300ms ease forwards')).toEqual({
            ...baseDefaults,
            name: 'fade-in-up',
            isPreset: true,
            durationMs: 300,
            fillMode: 'forwards',
        });
    });
    it('parses durations + delays positionally (first time = duration, second = delay)', () => {
        expect(parseAnimationShorthand('shake 500ms ease 100ms')).toEqual({
            ...baseDefaults,
            name: 'shake',
            isPreset: true,
            durationMs: 500,
            delayMs: 100,
        });
    });
    it('parses iteration counts: number or infinite', () => {
        expect(parseAnimationShorthand('spin 1s linear infinite')).toEqual({
            ...baseDefaults,
            name: 'spin',
            isPreset: true,
            durationMs: 1000,
            easing: 'linear',
            iterationCount: 'infinite',
        });
        expect(parseAnimationShorthand('shake 500ms ease 3')).toEqual({
            ...baseDefaults,
            name: 'shake',
            isPreset: true,
            durationMs: 500,
            iterationCount: 3,
        });
    });
    it('parses every direction value', () => {
        for (const dir of [
            'normal',
            'reverse',
            'alternate',
            'alternate-reverse',
        ]) {
            const parsed = parseAnimationShorthand(`pulse 1s ease infinite ${dir}`);
            expect(parsed?.direction).toBe(dir);
        }
    });
    it('parses every fill-mode value', () => {
        for (const fill of ['none', 'forwards', 'backwards', 'both']) {
            const parsed = parseAnimationShorthand(`fade-in 300ms ease ${fill}`);
            expect(parsed?.fillMode).toBe(fill);
        }
    });
    it('parses play state', () => {
        const parsed = parseAnimationShorthand('spin 1s linear infinite paused');
        expect(parsed?.playState).toBe('paused');
    });
    it('parses cubic-bezier easing without splitting on the inner commas', () => {
        const parsed = parseAnimationShorthand('fade-in-up 300ms cubic-bezier(0.4, 0, 0.2, 1) forwards');
        expect(parsed?.easing).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    });
    it('handles tokens in any order between time/easing groups', () => {
        // Direction / fill-mode / play-state are positionally
        // independent — agents may write them in any order.
        const parsed = parseAnimationShorthand('shake 500ms ease forwards alternate paused 2');
        expect(parsed).toMatchObject({
            name: 'shake',
            durationMs: 500,
            iterationCount: 2,
            direction: 'alternate',
            fillMode: 'forwards',
            playState: 'paused',
        });
    });
    it('returns null when the value is empty or `none`', () => {
        expect(parseAnimationShorthand('')).toBeNull();
        expect(parseAnimationShorthand('none')).toBeNull();
    });
    it('returns null on multi-animation source (top-level commas)', () => {
        // The caller is expected to route the whole declaration to
        // customProperties verbatim when this returns null.
        expect(parseAnimationShorthand('fade-in 300ms, slide-in-left 500ms')).toBeNull();
    });
    it('does NOT split inside cubic-bezier when checking for multi-animation', () => {
        // The parens around inner commas must be respected — this is
        // a single animation, not multi.
        const parsed = parseAnimationShorthand('fade-in-up 300ms cubic-bezier(0.4, 0, 0.2, 1)');
        expect(parsed).not.toBeNull();
        expect(parsed?.name).toBe('fade-in-up');
    });
    it('returns null when no name is present', () => {
        // Just timings and keywords — no custom-ident.
        expect(parseAnimationShorthand('300ms ease forwards')).toBeNull();
    });
    it('marks isPreset=false for unknown names', () => {
        const parsed = parseAnimationShorthand('myCustomAnim 300ms ease');
        expect(parsed?.name).toBe('myCustomAnim');
        expect(parsed?.isPreset).toBe(false);
    });
    it('parses second-unit times correctly', () => {
        const parsed = parseAnimationShorthand('spin 2s linear infinite');
        expect(parsed?.durationMs).toBe(2000);
    });
});
describe('formatAnimationShorthand', () => {
    it('emits name + duration + easing when other fields are defaults', () => {
        // Easing is always emitted to match `formatTransitionShorthand`'s
        // convention — third positional anchor, expected to be visible
        // for grokability.
        const result = formatAnimationShorthand({
            name: 'fade-in',
            isPreset: true,
            durationMs: 300,
            easing: 'ease',
            delayMs: 0,
            iterationCount: 1,
            direction: 'normal',
            fillMode: 'none',
            playState: 'running',
        });
        expect(result).toBe('fade-in 300ms ease');
    });
    it('emits easing whenever delay is non-default (positional)', () => {
        const result = formatAnimationShorthand({
            name: 'shake',
            isPreset: true,
            durationMs: 500,
            easing: 'ease',
            delayMs: 100,
            iterationCount: 1,
            direction: 'normal',
            fillMode: 'none',
            playState: 'running',
        });
        expect(result).toBe('shake 500ms ease 100ms');
    });
    it('emits the full chain when fields trail off defaults', () => {
        const result = formatAnimationShorthand({
            name: 'spin',
            isPreset: true,
            durationMs: 1000,
            easing: 'linear',
            delayMs: 0,
            iterationCount: 'infinite',
            direction: 'normal',
            fillMode: 'none',
            playState: 'running',
        });
        expect(result).toBe('spin 1s linear infinite');
    });
    it('uses second-unit when the duration is whole seconds', () => {
        // formatTransitionTime collapses whole-second values.
        const result = formatAnimationShorthand({
            name: 'spin',
            isPreset: true,
            durationMs: 2000,
            easing: 'linear',
            delayMs: 0,
            iterationCount: 'infinite',
            direction: 'normal',
            fillMode: 'none',
            playState: 'running',
        });
        expect(result).toContain('2s');
    });
    it('round-trips through parse → format for typical shorthands', () => {
        const cases = [
            'fade-in 300ms',
            'fade-in-up 300ms ease forwards',
            'spin 1s linear infinite',
            'shake 500ms ease 100ms 3',
            'pulse 1s ease-in-out infinite alternate',
        ];
        for (const original of cases) {
            const parsed = parseAnimationShorthand(original);
            expect(parsed).not.toBeNull();
            if (!parsed)
                continue;
            const reformatted = formatAnimationShorthand(parsed);
            const reparsed = parseAnimationShorthand(reformatted);
            expect(reparsed).toEqual(parsed);
        }
    });
});
