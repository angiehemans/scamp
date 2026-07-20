import { describe, it, expect } from 'vitest';
import { resolveTokenChain } from '@lib/resolveToken';
const tokens = (map) => Object.entries(map).map(([name, value]) => ({ name, value }));
describe('resolveTokenChain', () => {
    it('passes a concrete (non-var) value straight through', () => {
        expect(resolveTokenChain('#3b82f6', [])).toBe('#3b82f6');
        expect(resolveTokenChain('16px', tokens({ '--x': '#000' }))).toBe('16px');
    });
    it('resolves a single-level var reference', () => {
        expect(resolveTokenChain('var(--color-blue-500)', tokens({ '--color-blue-500': '#3b82f6' }))).toBe('#3b82f6');
    });
    it('follows a semantic → primitive → hex chain', () => {
        const t = tokens({
            '--color-brand': 'var(--color-brand-500)',
            '--color-brand-500': 'var(--color-blue-500)',
            '--color-blue-500': '#3b82f6',
        });
        expect(resolveTokenChain('var(--color-brand)', t)).toBe('#3b82f6');
    });
    it('returns null for a dangling reference', () => {
        expect(resolveTokenChain('var(--missing)', tokens({ '--x': '#000' }))).toBeNull();
        // ...and mid-chain dangling too.
        expect(resolveTokenChain('var(--a)', tokens({ '--a': 'var(--b)', '--b': 'var(--gone)' }))).toBeNull();
    });
    it('returns null on a reference cycle instead of looping', () => {
        const t = tokens({ '--a': 'var(--b)', '--b': 'var(--a)' });
        expect(resolveTokenChain('var(--a)', t)).toBeNull();
        // Self-reference.
        expect(resolveTokenChain('var(--x)', tokens({ '--x': 'var(--x)' }))).toBeNull();
    });
    it('does not resolve var() with a fallback or inside calc() (passthrough)', () => {
        const t = tokens({ '--x': '#3b82f6' });
        expect(resolveTokenChain('var(--x, #fff)', t)).toBe('var(--x, #fff)');
        expect(resolveTokenChain('calc(var(--x) * 2)', t)).toBe('calc(var(--x) * 2)');
    });
    it('tolerates whitespace inside the var() call', () => {
        expect(resolveTokenChain('var( --color-primary )', tokens({ '--color-primary': '#111' }))).toBe('#111');
    });
});
