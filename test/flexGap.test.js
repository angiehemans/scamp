import { describe, it, expect } from 'vitest';
import { axisGapPatch, effectiveAxisGaps, hasAxisGaps } from '@lib/flexGap';
import { tokenSpaceValue } from '@lib/spaceValue';
describe('hasAxisGaps', () => {
    it('is false when only the shorthand gap is set', () => {
        expect(hasAxisGaps({ gap: 8, columnGap: 0, rowGap: 0 })).toBe(false);
    });
    it('is true when either axis carries a value, including a token', () => {
        expect(hasAxisGaps({ gap: 0, columnGap: 8, rowGap: 0 })).toBe(true);
        expect(hasAxisGaps({ gap: 0, columnGap: 0, rowGap: tokenSpaceValue('--space-md') })).toBe(true);
    });
});
describe('effectiveAxisGaps', () => {
    it('falls back to gap on an axis that has no value of its own', () => {
        expect(effectiveAxisGaps({ gap: 8, columnGap: 0, rowGap: 16 })).toEqual({
            columnGap: 8,
            rowGap: 16,
        });
    });
    it('shows gap on both axes for a gap-only element', () => {
        expect(effectiveAxisGaps({ gap: 12, columnGap: 0, rowGap: 0 })).toEqual({
            columnGap: 12,
            rowGap: 12,
        });
    });
});
describe('axisGapPatch', () => {
    it('expands a lone gap into both axes before applying the edit', () => {
        // The user was looking at 8 / 8; editing row gap must not zero column gap.
        expect(axisGapPatch({ gap: 8, columnGap: 0, rowGap: 0 }, 'rowGap', 16)).toEqual({
            columnGap: 8,
            rowGap: 16,
            gap: 0,
        });
    });
    it('writes only the edited axis once axis fields exist', () => {
        expect(axisGapPatch({ gap: 0, columnGap: 8, rowGap: 8 }, 'columnGap', 4)).toEqual({
            columnGap: 4,
        });
    });
    it('writes only the edited axis when nothing was set at all', () => {
        expect(axisGapPatch({ gap: 0, columnGap: 0, rowGap: 0 }, 'rowGap', 16)).toEqual({
            rowGap: 16,
        });
    });
    it('carries a token gap through the expansion', () => {
        const token = tokenSpaceValue('--space-md');
        expect(axisGapPatch({ gap: token, columnGap: 0, rowGap: 0 }, 'columnGap', 4)).toEqual({
            columnGap: 4,
            rowGap: token,
            gap: 0,
        });
    });
});
