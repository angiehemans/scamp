import { describe, it, expect } from 'vitest';
import { parseFlexShorthand } from '@lib/parsers';
describe('parseFlexShorthand', () => {
    it('expands the keywords per spec', () => {
        expect(parseFlexShorthand('none')).toEqual({ flexGrow: 0, flexShrink: 0, flexBasis: '' });
        expect(parseFlexShorthand('auto')).toEqual({ flexGrow: 1, flexShrink: 1, flexBasis: '' });
        expect(parseFlexShorthand('initial')).toEqual({ flexGrow: 0, flexShrink: 1, flexBasis: '' });
    });
    it('reads a lone number as grow with a 0% basis', () => {
        expect(parseFlexShorthand('1')).toEqual({ flexGrow: 1, flexShrink: 1, flexBasis: '0%' });
        expect(parseFlexShorthand('2.5')).toEqual({ flexGrow: 2.5, flexShrink: 1, flexBasis: '0%' });
    });
    it('reads a lone length as the basis', () => {
        expect(parseFlexShorthand('200px')).toEqual({ flexGrow: 1, flexShrink: 1, flexBasis: '200px' });
        expect(parseFlexShorthand('50%')).toEqual({ flexGrow: 1, flexShrink: 1, flexBasis: '50%' });
        expect(parseFlexShorthand('var(--w)')).toEqual({ flexGrow: 1, flexShrink: 1, flexBasis: 'var(--w)' });
    });
    it('reads two numbers as grow shrink', () => {
        expect(parseFlexShorthand('0 0')).toEqual({ flexGrow: 0, flexShrink: 0, flexBasis: '0%' });
    });
    it('reads number + length as grow basis', () => {
        expect(parseFlexShorthand('1 200px')).toEqual({ flexGrow: 1, flexShrink: 1, flexBasis: '200px' });
    });
    it('reads all three', () => {
        expect(parseFlexShorthand('1 1 200px')).toEqual({ flexGrow: 1, flexShrink: 1, flexBasis: '200px' });
        expect(parseFlexShorthand('0 0 auto')).toEqual({ flexGrow: 0, flexShrink: 0, flexBasis: '' });
    });
    it('tolerates surrounding whitespace and repeated spaces', () => {
        expect(parseFlexShorthand('  1   1   0%  ')).toEqual({ flexGrow: 1, flexShrink: 1, flexBasis: '0%' });
    });
    it('refuses anything it cannot reduce, so it is preserved verbatim', () => {
        for (const bad of ['', '-1', 'grow', '1 1 1 1', '1 auto 1', 'inherit', 'calc(', '1 -1']) {
            expect(parseFlexShorthand(bad), bad).toBeNull();
        }
    });
});
