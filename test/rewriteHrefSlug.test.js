import { describe, it, expect } from 'vitest';
import { rewriteHrefSlug } from '../src/main/ipc/pageRename';
describe('rewriteHrefSlug', () => {
    it('rewrites a bare matching href', () => {
        expect(rewriteHrefSlug('<a href="/about">x</a>', 'about', 'landing')).toBe('<a href="/landing">x</a>');
    });
    it('rewrites a href followed by a fragment', () => {
        expect(rewriteHrefSlug('<a href="/about#contact">x</a>', 'about', 'landing')).toBe('<a href="/landing#contact">x</a>');
    });
    it('rewrites a href followed by a subpath', () => {
        expect(rewriteHrefSlug('<a href="/about/team">x</a>', 'about', 'landing')).toBe('<a href="/landing/team">x</a>');
    });
    it('rewrites a href followed by a query string', () => {
        expect(rewriteHrefSlug('<a href="/about?tab=team">x</a>', 'about', 'landing')).toBe('<a href="/landing?tab=team">x</a>');
    });
    it('handles single-quoted hrefs', () => {
        expect(rewriteHrefSlug(`<a href='/about'>x</a>`, 'about', 'landing')).toBe(`<a href='/landing'>x</a>`);
    });
    it('rewrites every occurrence in the input', () => {
        const tsx = `<a href="/about">x</a><a href="/about/team">y</a>`;
        expect(rewriteHrefSlug(tsx, 'about', 'landing')).toBe(`<a href="/landing">x</a><a href="/landing/team">y</a>`);
    });
    it('does not rewrite a non-matching slug that shares a prefix', () => {
        expect(rewriteHrefSlug('<a href="/about-us">x</a>', 'about', 'landing')).toBe('<a href="/about-us">x</a>');
    });
    it('does not rewrite a string literal that happens to look like /old', () => {
        // The captured pattern is anchored on `href=` so a plain string
        // literal containing `/about` is not touched.
        const tsx = `const path = "/about";`;
        expect(rewriteHrefSlug(tsx, 'about', 'landing')).toBe(tsx);
    });
    it('returns the input unchanged when oldSlug equals newSlug', () => {
        const tsx = `<a href="/about">x</a>`;
        expect(rewriteHrefSlug(tsx, 'about', 'about')).toBe(tsx);
    });
    it('returns the input unchanged when there are no matches', () => {
        const tsx = `<a href="/contact">x</a>`;
        expect(rewriteHrefSlug(tsx, 'about', 'landing')).toBe(tsx);
    });
    it('only matches exact slug, not a hyphenated longer slug', () => {
        expect(rewriteHrefSlug('<a href="/about-team">x</a>', 'about', 'landing')).toBe('<a href="/about-team">x</a>');
    });
    it('handles whitespace around `=` in the href attribute', () => {
        expect(rewriteHrefSlug('<a href = "/about" >x</a>', 'about', 'landing')).toBe('<a href = "/landing" >x</a>');
    });
});
