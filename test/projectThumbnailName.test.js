import { describe, it, expect } from 'vitest';
import { THUMBNAIL_PAGE_NAME, thumbnailNameFor } from '../src/renderer/src/lib/projectThumbnail';
/**
 * Which save is the one that represents the project on the start
 * screen.
 *
 * A Scamp-framework project has no pages — every page is a view, whose
 * edit target is a `component` — so a `kind === 'page'` gate never
 * fired and every framework project had a blank card from the day the
 * format shipped. see docs/notes/project-thumbnails.md
 */
describe('thumbnailNameFor', () => {
    it('captures the home page of a Next.js project', () => {
        expect(thumbnailNameFor({ kind: 'page', name: 'home' }, undefined)).toBe(THUMBNAIL_PAGE_NAME);
    });
    it('captures the home VIEW of a framework project', () => {
        // The whole bug: this target is a `component`, and its name is
        // `Home` where the constant says `home`.
        expect(thumbnailNameFor({ kind: 'component', name: 'Home' }, 'view')).toBe(THUMBNAIL_PAGE_NAME);
    });
    it('ignores a view that is not the home one', () => {
        expect(thumbnailNameFor({ kind: 'component', name: 'Pricing' }, 'view')).toBe('pricing');
    });
    it('ignores a reusable component, however it is named', () => {
        // A component called `Home` is not the project's front page.
        expect(thumbnailNameFor({ kind: 'component', name: 'Home' }, 'component')).toBeNull();
    });
    it('ignores a component whose tree has not been parsed yet', () => {
        expect(thumbnailNameFor({ kind: 'component', name: 'Home' }, undefined)).toBeNull();
    });
    it('passes another page through for the caller to filter', () => {
        // The capture itself drops anything but home; this only decides
        // which name that check sees.
        expect(thumbnailNameFor({ kind: 'page', name: 'about' }, undefined)).toBe('about');
    });
});
