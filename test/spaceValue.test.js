import { describe, it, expect } from 'vitest';
import { formatSpaceShorthand, formatSpaceValue, isTokenSpaceValue, isZeroSpaceTuple, isZeroSpaceValue, spaceTupleEquals, spaceValueEquals, spaceValueNumberOrZero, tokenSpaceValue, } from '@lib/spaceValue';
const tok = (ref) => tokenSpaceValue(ref);
describe('SpaceValue helpers', () => {
    describe('formatSpaceValue', () => {
        it('emits px for plain numbers', () => {
            expect(formatSpaceValue(0)).toBe('0px');
            expect(formatSpaceValue(16)).toBe('16px');
            expect(formatSpaceValue(-4)).toBe('-4px');
        });
        it('emits the token ref verbatim', () => {
            expect(formatSpaceValue(tok('var(--space-md)'))).toBe('var(--space-md)');
            expect(formatSpaceValue(tok('var(--gutter, 16px)'))).toBe('var(--gutter, 16px)');
        });
    });
    describe('spaceValueEquals', () => {
        it('compares numbers structurally', () => {
            expect(spaceValueEquals(16, 16)).toBe(true);
            expect(spaceValueEquals(16, 17)).toBe(false);
        });
        it('compares tokens by ref string', () => {
            expect(spaceValueEquals(tok('var(--space-md)'), tok('var(--space-md)'))).toBe(true);
            expect(spaceValueEquals(tok('var(--space-md)'), tok('var(--space-sm)'))).toBe(false);
        });
        it('returns false when comparing number to token', () => {
            expect(spaceValueEquals(16, tok('var(--space-md)'))).toBe(false);
        });
    });
    describe('isZeroSpaceValue', () => {
        it('is true for plain 0', () => {
            expect(isZeroSpaceValue(0)).toBe(true);
        });
        it('is false for non-zero numbers', () => {
            expect(isZeroSpaceValue(16)).toBe(false);
        });
        it('is false for tokens — even those that resolve to 0', () => {
            // Tokens are explicit authoring intent; never treat as zero.
            expect(isZeroSpaceValue(tok('var(--space-0)'))).toBe(false);
            expect(isZeroSpaceValue(tok('var(--space-md)'))).toBe(false);
        });
    });
    describe('isZeroSpaceTuple', () => {
        it('is true for [0,0,0,0]', () => {
            expect(isZeroSpaceTuple([0, 0, 0, 0])).toBe(true);
        });
        it('is false when any side is non-zero', () => {
            expect(isZeroSpaceTuple([0, 0, 0, 4])).toBe(false);
        });
        it('is false when any side is a token (even if numerically zero)', () => {
            expect(isZeroSpaceTuple([0, 0, 0, tok('var(--space-md)')])).toBe(false);
        });
    });
    describe('spaceTupleEquals', () => {
        it('compares element-wise', () => {
            expect(spaceTupleEquals([16, 24, 16, 24], [16, 24, 16, 24])).toBe(true);
            expect(spaceTupleEquals([16, 24, 16, 24], [16, 24, 16, 32])).toBe(false);
        });
        it('handles mixed token / number tuples', () => {
            const a = [16, tok('var(--space-md)'), 16, tok('var(--space-md)')];
            const b = [16, tok('var(--space-md)'), 16, tok('var(--space-md)')];
            expect(spaceTupleEquals(a, b)).toBe(true);
        });
    });
    describe('formatSpaceShorthand', () => {
        it('collapses all four equal numbers to one', () => {
            expect(formatSpaceShorthand([16, 16, 16, 16])).toBe('16px');
        });
        it('collapses vertical-horizontal symmetry to two values', () => {
            expect(formatSpaceShorthand([16, 24, 16, 24])).toBe('16px 24px');
        });
        it('collapses three-value form when right === left', () => {
            expect(formatSpaceShorthand([16, 24, 32, 24])).toBe('16px 24px 32px');
        });
        it('emits four values when fully asymmetric', () => {
            expect(formatSpaceShorthand([16, 24, 32, 8])).toBe('16px 24px 32px 8px');
        });
        it('collapses all-equal token tuples to a single var()', () => {
            const t = tok('var(--space-md)');
            expect(formatSpaceShorthand([t, t, t, t])).toBe('var(--space-md)');
        });
        it('emits mixed token / number sides in their stored form', () => {
            const tm = tok('var(--space-md)');
            expect(formatSpaceShorthand([16, tm, 16, tm])).toBe('16px var(--space-md)');
        });
        it('keeps two distinct tokens separate (no collapse when they differ)', () => {
            const ts = tok('var(--space-sm)');
            const tm = tok('var(--space-md)');
            expect(formatSpaceShorthand([ts, tm, ts, tm])).toBe('var(--space-sm) var(--space-md)');
        });
    });
    describe('spaceValueNumberOrZero', () => {
        it('returns the number directly', () => {
            expect(spaceValueNumberOrZero(16)).toBe(16);
        });
        it('returns 0 for tokens', () => {
            expect(spaceValueNumberOrZero(tok('var(--space-md)'))).toBe(0);
        });
    });
    describe('isTokenSpaceValue', () => {
        it('is true for tokens', () => {
            expect(isTokenSpaceValue(tok('var(--space-md)'))).toBe(true);
        });
        it('is false for numbers', () => {
            expect(isTokenSpaceValue(16)).toBe(false);
            expect(isTokenSpaceValue(0)).toBe(false);
        });
    });
});
