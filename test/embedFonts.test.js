// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { familiesUsedIn, familyOf, fontFacesFor, } from '../src/renderer/src/lib/embedFonts';
/**
 * Picking the `@font-face` rules a capture needs.
 *
 * A capture rasterises through a data: URL that can fetch nothing, so a
 * webfont has to be inlined or the text falls back — which is what made
 * every thumbnail come out in the wrong typeface. Embedding everything
 * a project declares is the other failure: a Google Fonts stylesheet is
 * a face per weight per unicode range, and none of the unused ones
 * belong in a thumbnail. see docs/notes/project-thumbnails.md
 */
describe('familyOf', () => {
    it('reads the family a rule declares', () => {
        expect(familyOf("@font-face { font-family: 'Inter'; src: url(a.woff2); }")).toBe('inter');
    });
    it('unquotes and lowercases, because a stack does neither consistently', () => {
        expect(familyOf('@font-face { font-family: "Inter Tight"; }')).toBe('inter tight');
    });
    it('returns null for a rule that declares none', () => {
        expect(familyOf('@font-face { src: url(a.woff2); }')).toBeNull();
    });
});
describe('familiesUsedIn', () => {
    it('collects every family on the subtree, not just the root', () => {
        document.body.innerHTML =
            '<div id="r" style="font-family: Inter, sans-serif"><p style="font-family: Fraunces">x</p></div>';
        const found = familiesUsedIn(document.getElementById('r'));
        expect(found.has('inter')).toBe(true);
        expect(found.has('fraunces')).toBe(true);
    });
    it('keeps the whole stack, since a fallback can be a real face too', () => {
        document.body.innerHTML = '<div id="r" style="font-family: Inter, Georgia"></div>';
        expect(familiesUsedIn(document.getElementById('r')).has('georgia')).toBe(true);
    });
});
describe('fontFacesFor', () => {
    const css = `
@font-face { font-family: 'Inter'; src: url(inter.woff2); }
@font-face { font-family: 'Unused'; src: url(unused.woff2); }
@font-face { font-family: "Inter"; src: url(inter-bold.woff2); font-weight: 700; }
`;
    it('keeps every face of a family in use', () => {
        // Weights and unicode ranges are separate rules; taking only the
        // first would drop the bold.
        const faces = fontFacesFor(css, new Set(['inter']));
        expect(faces).toHaveLength(2);
        expect(faces.join()).toContain('inter-bold.woff2');
    });
    it('leaves a family nothing on the page asks for', () => {
        expect(fontFacesFor(css, new Set(['inter'])).join()).not.toContain('unused.woff2');
    });
    it('returns nothing when the design is on system fonts', () => {
        expect(fontFacesFor(css, new Set(['system-ui', 'arial']))).toEqual([]);
    });
    it('survives css with no font-face rules at all', () => {
        expect(fontFacesFor('.a { color: red }', new Set(['inter']))).toEqual([]);
    });
});
