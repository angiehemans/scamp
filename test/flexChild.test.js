import { describe, it, expect } from 'vitest';
import { preserveDrawnSize, shrinkGuardPatch } from '@lib/flexChild';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID } from '@lib/element';
const element = (over = {}) => ({
    ...DEFAULT_RECT_STYLES,
    id: 'a1b2',
    type: 'rectangle',
    parentId: ROOT_ELEMENT_ID,
    childIds: [],
    x: 0,
    y: 0,
    customProperties: {},
    ...over,
});
const parentWith = (display, flexDirection = 'row') => element({ id: 'parent', parentId: null, display, flexDirection });
describe('preserveDrawnSize', () => {
    it('opts a flex child out of shrinking through the typed field', () => {
        // The bug: a drawn box reported its drawn width in CSS and rendered
        // narrower, because flex-shrink squashed it once the line overflowed.
        // The guard is `flexShrink`, not a custom property, so the Size
        // panel's "Don't shrink" toggle and the file agree.
        const result = preserveDrawnSize(element(), parentWith('flex'));
        expect(result.flexShrink).toBe(0);
        expect(result.customProperties).toEqual({});
    });
    it('leaves a grid child alone', () => {
        // A grid item is sized by its track and already honours an explicit
        // width, so the declaration would be noise in the output.
        expect(preserveDrawnSize(element(), parentWith('grid')).flexShrink).toBe(1);
    });
    it('leaves a child of a plain container alone', () => {
        expect(preserveDrawnSize(element(), parentWith('none')).flexShrink).toBe(1);
    });
    it('leaves the element alone when there is no parent', () => {
        expect(preserveDrawnSize(element(), undefined).flexShrink).toBe(1);
    });
    it('returns the same object when it changes nothing', () => {
        // Identity matters: the store spreads these into state, and a fresh
        // object for a no-op is a needless re-render.
        const el = element();
        expect(preserveDrawnSize(el, parentWith('none'))).toBe(el);
        expect(preserveDrawnSize(element({ flexShrink: 0 }), parentWith('flex')).flexShrink).toBe(0);
    });
    it('never overwrites a non-default flex-shrink', () => {
        // Either the user set it or it came from the file; both outrank a
        // default applied at creation.
        const el = element({ flexShrink: 0.5 });
        expect(preserveDrawnSize(el, parentWith('flex'))).toBe(el);
    });
    it('does not mutate the element it was given', () => {
        const el = element();
        preserveDrawnSize(el, parentWith('flex'));
        expect(el.flexShrink).toBe(1);
    });
    it('leaves every other field untouched', () => {
        const el = element({ widthValue: 180, heightValue: 120 });
        const result = preserveDrawnSize(el, parentWith('flex'));
        expect(result.widthValue).toBe(180);
        expect(result.heightValue).toBe(120);
        expect(result.id).toBe(el.id);
    });
});
describe('shrinkGuardPatch — px on the main axis means don’t shrink', () => {
    it('sets the guard when the main axis becomes fixed', () => {
        expect(shrinkGuardPatch(element(), parentWith('flex', 'row'), 'width', 'fixed')).toEqual({
            flexShrink: 0,
        });
        expect(shrinkGuardPatch(element(), parentWith('flex', 'column'), 'height', 'fixed')).toEqual({
            flexShrink: 0,
        });
    });
    it('ignores the cross axis — flex-shrink has no effect there', () => {
        expect(shrinkGuardPatch(element(), parentWith('flex', 'row'), 'height', 'fixed')).toEqual({});
        expect(shrinkGuardPatch(element(), parentWith('flex', 'column'), 'width', 'fixed')).toEqual({});
    });
    it('treats the reverse directions by axis', () => {
        expect(shrinkGuardPatch(element(), parentWith('flex', 'row-reverse'), 'width', 'fixed')).toEqual({ flexShrink: 0 });
        expect(shrinkGuardPatch(element(), parentWith('flex', 'column-reverse'), 'height', 'fixed')).toEqual({ flexShrink: 0 });
    });
    it('clears a guard Scamp set when the axis leaves px', () => {
        for (const mode of ['stretch', 'fit-content', 'auto']) {
            expect(shrinkGuardPatch(element({ flexShrink: 0 }), parentWith('flex', 'row'), 'width', mode)).toEqual({ flexShrink: 1 });
        }
    });
    it('never touches a hand-set shrink value', () => {
        expect(shrinkGuardPatch(element({ flexShrink: 0.5 }), parentWith('flex', 'row'), 'width', 'fixed')).toEqual({});
        expect(shrinkGuardPatch(element({ flexShrink: 0.5 }), parentWith('flex', 'row'), 'width', 'stretch')).toEqual({});
    });
    it('does nothing outside a flex parent', () => {
        expect(shrinkGuardPatch(element(), parentWith('grid'), 'width', 'fixed')).toEqual({});
        expect(shrinkGuardPatch(element(), parentWith('none'), 'width', 'fixed')).toEqual({});
        expect(shrinkGuardPatch(element(), undefined, 'width', 'fixed')).toEqual({});
    });
    it('is a no-op when the guard is already in the right state', () => {
        expect(shrinkGuardPatch(element({ flexShrink: 0 }), parentWith('flex'), 'width', 'fixed')).toEqual({});
        expect(shrinkGuardPatch(element(), parentWith('flex'), 'width', 'stretch')).toEqual({});
    });
});
