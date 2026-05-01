import { describe, it, expect } from 'vitest';
import { classifyToken } from '@lib/tokenClassify';
describe('classifyToken', () => {
    describe('font sizes (length values)', () => {
        it('classifies px lengths', () => {
            expect(classifyToken('16px')).toBe('fontSize');
            expect(classifyToken('0.5px')).toBe('fontSize');
        });
        it('classifies rem / em', () => {
            expect(classifyToken('1.125rem')).toBe('fontSize');
            expect(classifyToken('0.75em')).toBe('fontSize');
        });
        it('classifies % as a length (valid for font-size)', () => {
            expect(classifyToken('100%')).toBe('fontSize');
        });
        it('classifies vw / vh', () => {
            expect(classifyToken('2vw')).toBe('fontSize');
            expect(classifyToken('4vh')).toBe('fontSize');
        });
    });
    describe('line heights (unitless numbers)', () => {
        it('classifies plain decimals', () => {
            expect(classifyToken('1.5')).toBe('lineHeight');
            expect(classifyToken('1.25')).toBe('lineHeight');
        });
        it('classifies integers', () => {
            expect(classifyToken('2')).toBe('lineHeight');
            expect(classifyToken('0')).toBe('lineHeight');
        });
    });
    describe('font families', () => {
        it('recognises quoted names', () => {
            expect(classifyToken("'Inter'")).toBe('fontFamily');
            expect(classifyToken('"JetBrains Mono"')).toBe('fontFamily');
        });
        it('recognises a quoted + generic stack', () => {
            expect(classifyToken('"Inter", sans-serif')).toBe('fontFamily');
            expect(classifyToken("'JetBrains Mono', monospace")).toBe('fontFamily');
        });
        it('recognises a bare generic family', () => {
            expect(classifyToken('system-ui')).toBe('fontFamily');
            expect(classifyToken('sans-serif')).toBe('fontFamily');
        });
    });
    describe('colors', () => {
        it('recognises hex colors (3/6/8 digits)', () => {
            expect(classifyToken('#fff')).toBe('color');
            expect(classifyToken('#3b82f6')).toBe('color');
            expect(classifyToken('#3b82f6aa')).toBe('color');
        });
        it('recognises rgb / rgba', () => {
            expect(classifyToken('rgb(0, 0, 0)')).toBe('color');
            expect(classifyToken('rgba(0, 0, 0, 0.5)')).toBe('color');
        });
        it('recognises hsl / hsla', () => {
            expect(classifyToken('hsl(210, 50%, 50%)')).toBe('color');
        });
        it('recognises common named colors', () => {
            expect(classifyToken('red')).toBe('color');
            expect(classifyToken('rebeccapurple')).toBe('color');
            expect(classifyToken('transparent')).toBe('color');
        });
    });
    describe('unknown', () => {
        it('returns unknown for empty input', () => {
            expect(classifyToken('')).toBe('unknown');
            expect(classifyToken('   ')).toBe('unknown');
        });
        it('returns unknown for arbitrary strings', () => {
            expect(classifyToken('calc(16px + 2vw)')).toBe('unknown');
            expect(classifyToken('linear-gradient(#000, #fff)')).toBe('unknown');
            expect(classifyToken('notacolor')).toBe('unknown');
        });
    });
    describe('ordering (ambiguity resolution)', () => {
        it('unit rule wins over bare-number rule', () => {
            expect(classifyToken('1.5rem')).toBe('fontSize');
        });
        it('quoted string wins over bare-number inside a family stack', () => {
            // Edge case: user sets `"Inter", 1.5` — weird but we should
            // still read it as a family because of the quoted part.
            expect(classifyToken('"Inter", 1.5')).toBe('fontFamily');
        });
    });
});
