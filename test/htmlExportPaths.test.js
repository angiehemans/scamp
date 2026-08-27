import { describe, it, expect } from 'vitest';
import { cssPathFor, fromPageToRoot, htmlPathFor, pageDepth, rewriteAssetUrlForPage, rewriteHrefForPage, rootRelativePrefix, } from '@lib/htmlExportPaths';
describe('page paths', () => {
    it('puts the home page at the export root', () => {
        expect(htmlPathFor('home')).toBe('index.html');
        expect(cssPathFor('home')).toBe('index.css');
        expect(pageDepth('home')).toBe(0);
    });
    it('gives every other page its own directory so the route survives', () => {
        expect(htmlPathFor('about')).toBe('about/index.html');
        expect(cssPathFor('about')).toBe('about/index.css');
        expect(pageDepth('about')).toBe(1);
    });
    it('co-locates a page stylesheet with its markup', () => {
        // The stylesheet link is a bare filename, so the page never reaches
        // sideways for it.
        expect(cssPathFor('about').replace('index.css', '')).toBe(htmlPathFor('about').replace('index.html', ''));
    });
});
describe('rootRelativePrefix', () => {
    it('is empty at the export root', () => {
        expect(rootRelativePrefix(0)).toBe('');
    });
    it('climbs one level for a page in its own directory', () => {
        expect(rootRelativePrefix(1)).toBe('../');
    });
    it('climbs once per level', () => {
        expect(rootRelativePrefix(3)).toBe('../../../');
    });
    it('treats a negative depth as the root rather than emitting nothing usable', () => {
        expect(rootRelativePrefix(-1)).toBe('');
    });
});
describe('fromPageToRoot', () => {
    it('addresses a root file directly from the home page', () => {
        expect(fromPageToRoot('home', 'theme.css')).toBe('theme.css');
    });
    it('climbs out of a page directory', () => {
        expect(fromPageToRoot('about', 'theme.css')).toBe('../theme.css');
    });
});
describe('rewriteAssetUrlForPage', () => {
    it('turns a server-root asset path into a relative one for the home page', () => {
        expect(rewriteAssetUrlForPage('/assets/hero.webp', 'home')).toBe('assets/hero.webp');
    });
    it('climbs out of a page directory for a nested page', () => {
        expect(rewriteAssetUrlForPage('/assets/hero.webp', 'about')).toBe('../assets/hero.webp');
    });
    it('normalises the legacy ./assets form to the same result', () => {
        expect(rewriteAssetUrlForPage('./assets/hero.webp', 'about')).toBe('../assets/hero.webp');
    });
    it('leaves an absolute http url alone', () => {
        expect(rewriteAssetUrlForPage('https://cdn.example.com/x.png', 'about')).toBe('https://cdn.example.com/x.png');
    });
    it('leaves a data url alone', () => {
        expect(rewriteAssetUrlForPage('data:image/svg+xml;base64,AAA', 'about')).toBe('data:image/svg+xml;base64,AAA');
    });
    it('leaves a protocol-relative url alone', () => {
        expect(rewriteAssetUrlForPage('//cdn.example.com/x.png', 'about')).toBe('//cdn.example.com/x.png');
    });
    it('leaves an empty value alone', () => {
        expect(rewriteAssetUrlForPage('', 'about')).toBe('');
    });
});
describe('rewriteHrefForPage', () => {
    const pages = ['home', 'about', 'contact'];
    it('points the home route at the root index from the home page', () => {
        expect(rewriteHrefForPage('/', 'home', pages)).toBe('index.html');
    });
    it('climbs back to the root index from a nested page', () => {
        expect(rewriteHrefForPage('/', 'about', pages)).toBe('../index.html');
    });
    it('links from the home page into a page directory', () => {
        expect(rewriteHrefForPage('/about', 'home', pages)).toBe('about/index.html');
    });
    it('links sideways between two nested pages', () => {
        expect(rewriteHrefForPage('/contact', 'about', pages)).toBe('../contact/index.html');
    });
    it('leaves an external url alone', () => {
        expect(rewriteHrefForPage('https://example.com', 'home', pages)).toBe('https://example.com');
    });
    it('leaves a fragment link alone', () => {
        expect(rewriteHrefForPage('#section', 'home', pages)).toBe('#section');
    });
    it('leaves a route with no matching page alone', () => {
        // Pointing it at a file the export never wrote would turn a link that
        // merely 404s in one place into one that 404s everywhere.
        expect(rewriteHrefForPage('/missing', 'home', pages)).toBe('/missing');
    });
    it('leaves a deeper path alone, since pages cannot nest', () => {
        expect(rewriteHrefForPage('/about/team', 'home', pages)).toBe('/about/team');
    });
    it('leaves a route carrying a query string alone', () => {
        expect(rewriteHrefForPage('/about?ref=nav', 'home', pages)).toBe('/about?ref=nav');
    });
    it('leaves an empty href alone', () => {
        expect(rewriteHrefForPage('', 'home', pages)).toBe('');
    });
});
