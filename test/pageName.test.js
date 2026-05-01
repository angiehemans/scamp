import { describe, expect, it } from 'vitest';
import { validatePageName } from '../src/shared/pageName';
describe('validatePageName', () => {
    it('accepts a simple lowercase alphanumeric name', () => {
        expect(validatePageName('home', [])).toEqual({ ok: true, value: 'home' });
    });
    it('accepts names with hyphens', () => {
        expect(validatePageName('checkout-flow', [])).toEqual({
            ok: true,
            value: 'checkout-flow',
        });
    });
    it('accepts names with digits', () => {
        expect(validatePageName('page2', [])).toEqual({ ok: true, value: 'page2' });
    });
    it('trims outer whitespace before validating', () => {
        expect(validatePageName('  home  ', [])).toEqual({ ok: true, value: 'home' });
    });
    it('rejects empty strings', () => {
        const result = validatePageName('', []);
        expect(result.ok).toBe(false);
    });
    it('rejects a whitespace-only name', () => {
        const result = validatePageName('   ', []);
        expect(result.ok).toBe(false);
    });
    it('rejects uppercase letters', () => {
        const result = validatePageName('Home', []);
        expect(result.ok).toBe(false);
    });
    it('rejects spaces inside the name', () => {
        const result = validatePageName('my page', []);
        expect(result.ok).toBe(false);
    });
    it('rejects underscores', () => {
        const result = validatePageName('my_page', []);
        expect(result.ok).toBe(false);
    });
    it('rejects special characters', () => {
        const result = validatePageName('home!', []);
        expect(result.ok).toBe(false);
    });
    it('rejects names that collide with an existing page', () => {
        const result = validatePageName('home', ['home', 'about']);
        expect(result.ok).toBe(false);
    });
    it('rejects collisions case-insensitively', () => {
        const result = validatePageName('home', ['Home']);
        expect(result.ok).toBe(false);
    });
    it('allows a name that differs from existing names', () => {
        expect(validatePageName('contact', ['home', 'about'])).toEqual({
            ok: true,
            value: 'contact',
        });
    });
});
