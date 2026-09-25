// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { codePointsOf, familiesUsedIn, familyOf, fontFacesFor, rangeCovers, unicodeRangeOf, } from '../src/renderer/src/lib/embedFonts';
/** Latin text, as any English page is. */
const LATIN = codePointsOf('Ship the thing');
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
describe('unicodeRangeOf and rangeCovers', () => {
    it('covers everything when a face declares no range', () => {
        expect(unicodeRangeOf('@font-face { src: url(a.woff2) }')).toBeNull();
        expect(rangeCovers(null, LATIN)).toBe(true);
    });
    it('matches a latin range against latin text', () => {
        expect(rangeCovers('U+0000-00FF, U+0131', LATIN)).toBe(true);
    });
    it('rejects a cyrillic range for latin text', () => {
        expect(rangeCovers('U+0301, U+0400-045F', LATIN)).toBe(false);
    });
    it('understands the wildcard form', () => {
        expect(rangeCovers('U+00??', LATIN)).toBe(true);
        expect(rangeCovers('U+30??', LATIN)).toBe(false);
    });
    it('matches a single code point', () => {
        expect(rangeCovers('U+0053', codePointsOf('S'))).toBe(true);
        expect(rangeCovers('U+0053', codePointsOf('x'))).toBe(false);
    });
});
describe('fontFacesFor', () => {
    const css = `
@font-face { font-family: 'Inter'; src: url(inter.woff2); }
@font-face { font-family: 'Unused'; src: url(unused.woff2); }
@font-face { font-family: "Inter"; src: url(inter-bold.woff2); font-weight: 700; }
`;
    it('keeps every face of a family in use', () => {
        // Weights are separate rules; taking only the first drops the bold.
        const faces = fontFacesFor(css, new Set(['inter']), LATIN);
        expect(faces).toHaveLength(2);
        expect(faces.join()).toContain('inter-bold.woff2');
    });
    it('leaves a family nothing on the page asks for', () => {
        expect(fontFacesFor(css, new Set(['inter']), LATIN).join()).not.toContain('unused.woff2');
    });
    it('returns nothing when the design is on system fonts', () => {
        expect(fontFacesFor(css, new Set(['system-ui', 'arial']), LATIN)).toEqual([]);
    });
    it('survives css with no font-face rules at all', () => {
        expect(fontFacesFor('.a { color: red }', new Set(['inter']), LATIN)).toEqual([]);
    });
    it('drops the subsets the page has no characters for', () => {
        // The bug this exists for: Google serves seven subsets per weight
        // and puts `latin` LAST, so embedding in order spent the byte cap
        // on alphabets no English page renders and never reached the one
        // the text was set in.
        const google = `
@font-face { font-family: 'Inter'; src: url(cyr.woff2); unicode-range: U+0301, U+0400-045F; }
@font-face { font-family: 'Inter'; src: url(greek.woff2); unicode-range: U+0370-03FF; }
@font-face { font-family: 'Inter'; src: url(viet.woff2); unicode-range: U+0102-0103, U+1EA0-1EF9; }
@font-face { font-family: 'Inter'; src: url(latin.woff2); unicode-range: U+0000-00FF, U+0131; }
`;
        const faces = fontFacesFor(google, new Set(['inter']), LATIN);
        expect(faces).toHaveLength(1);
        expect(faces[0]).toContain('latin.woff2');
    });
    it('keeps a subset the page DOES have characters for', () => {
        const google = `
@font-face { font-family: 'Inter'; src: url(cyr.woff2); unicode-range: U+0400-045F; }
@font-face { font-family: 'Inter'; src: url(latin.woff2); unicode-range: U+0000-00FF; }
`;
        const faces = fontFacesFor(google, new Set(['inter']), codePointsOf('Привет hello'));
        expect(faces).toHaveLength(2);
    });
});
