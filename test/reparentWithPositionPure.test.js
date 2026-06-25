import { describe, it, expect } from 'vitest';
import { reparentWithPositionPure, ROOT_ELEMENT_ID, } from '@lib/element';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
const makeRect = (overrides) => ({
    ...DEFAULT_RECT_STYLES,
    type: 'rectangle',
    parentId: ROOT_ELEMENT_ID,
    childIds: [],
    x: 0,
    y: 0,
    customProperties: {},
    ...overrides,
});
const makeRoot = (childIds = []) => ({
    id: ROOT_ELEMENT_ID,
    type: 'rectangle',
    parentId: null,
    childIds,
    widthMode: 'fixed',
    widthValue: 1440,
    heightMode: 'fixed',
    heightValue: 900,
    x: 0,
    y: 0,
    display: 'none',
    flexDirection: 'row',
    gap: 0,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gridTemplateColumns: '',
    gridTemplateRows: '',
    columnGap: 0,
    rowGap: 0,
    justifyItems: 'stretch',
    gridColumn: '',
    gridRow: '',
    alignSelf: 'stretch',
    justifySelf: 'stretch',
    padding: [0, 0, 0, 0],
    margin: [0, 0, 0, 0],
    backgroundColor: '#ffffff',
    borderRadius: [0, 0, 0, 0],
    borderWidth: [0, 0, 0, 0],
    borderStyle: 'none',
    borderColor: '#000000',
    opacity: 1,
    visibilityMode: 'visible',
    position: 'auto',
    mixBlendMode: 'normal',
    backgroundBlendMode: 'normal',
    boxShadows: [],
    filters: [],
    backdropFilters: [],
    toggledOffGroups: [],
    transitions: [],
    inlineFragments: [],
    customProperties: {},
});
describe('reparentWithPositionPure', () => {
    it('reparents across parents and writes the drop position', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a', 'b']),
            a: makeRect({ id: 'a', x: 10, y: 10 }),
            b: makeRect({ id: 'b', childIds: [] }),
        };
        const next = reparentWithPositionPure(elements, 'a', 'b', 0, 50, 60);
        expect(next[ROOT_ELEMENT_ID].childIds).toEqual(['b']);
        expect(next['b'].childIds).toEqual(['a']);
        expect(next['a'].parentId).toBe('b');
        expect(next['a'].x).toBe(50);
        expect(next['a'].y).toBe(60);
    });
    it('gives a flex child a position when it is dragged out to an absolute parent', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['flex', 'abs']),
            flex: makeRect({ id: 'flex', display: 'flex', childIds: ['c'] }),
            // Flex item: stored x/y is meaningless (0) while inside the flex parent.
            c: makeRect({ id: 'c', parentId: 'flex', x: 0, y: 0 }),
            abs: makeRect({ id: 'abs', childIds: [] }),
        };
        const next = reparentWithPositionPure(elements, 'c', 'abs', 0, 120, 80);
        expect(next['c'].parentId).toBe('abs');
        expect(next['c'].x).toBe(120);
        expect(next['c'].y).toBe(80);
        expect(next['abs'].childIds).toEqual(['c']);
        expect(next['flex'].childIds).toEqual([]);
    });
    it('inserts at the requested index in the destination parent', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a', 'dest']),
            a: makeRect({ id: 'a' }),
            dest: makeRect({ id: 'dest', childIds: ['x', 'y'] }),
            x: makeRect({ id: 'x', parentId: 'dest' }),
            y: makeRect({ id: 'y', parentId: 'dest' }),
        };
        const next = reparentWithPositionPure(elements, 'a', 'dest', 1, 5, 5);
        expect(next['dest'].childIds).toEqual(['x', 'a', 'y']);
    });
    it('clamps an out-of-range index to the end of the destination', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a', 'dest']),
            a: makeRect({ id: 'a' }),
            dest: makeRect({ id: 'dest', childIds: ['x'] }),
            x: makeRect({ id: 'x', parentId: 'dest' }),
        };
        const next = reparentWithPositionPure(elements, 'a', 'dest', 99, 5, 5);
        expect(next['dest'].childIds).toEqual(['x', 'a']);
    });
    it('refuses to reparent an element into itself', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a']),
            a: makeRect({ id: 'a' }),
        };
        expect(reparentWithPositionPure(elements, 'a', 'a', 0, 0, 0)).toBeNull();
    });
    it('refuses to reparent an element into one of its descendants', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a']),
            a: makeRect({ id: 'a', childIds: ['b'] }),
            b: makeRect({ id: 'b', parentId: 'a', childIds: ['c'] }),
            c: makeRect({ id: 'c', parentId: 'b' }),
        };
        expect(reparentWithPositionPure(elements, 'a', 'c', 0, 0, 0)).toBeNull();
    });
    it('refuses to reparent the root element', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a']),
            a: makeRect({ id: 'a' }),
        };
        expect(reparentWithPositionPure(elements, ROOT_ELEMENT_ID, 'a', 0, 0, 0)).toBeNull();
    });
    it('returns null when the source element does not exist', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(),
        };
        expect(reparentWithPositionPure(elements, 'missing', ROOT_ELEMENT_ID, 0, 0, 0)).toBeNull();
    });
    it('returns null when the destination parent does not exist', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a']),
            a: makeRect({ id: 'a' }),
        };
        expect(reparentWithPositionPure(elements, 'a', 'missing', 0, 0, 0)).toBeNull();
    });
    it('does not mutate the input elements map', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a', 'b']),
            a: makeRect({ id: 'a', x: 10, y: 10 }),
            b: makeRect({ id: 'b', childIds: [] }),
        };
        reparentWithPositionPure(elements, 'a', 'b', 0, 50, 60);
        expect(elements['a'].parentId).toBe(ROOT_ELEMENT_ID);
        expect(elements['a'].x).toBe(10);
        expect(elements['b'].childIds).toEqual([]);
        expect(elements[ROOT_ELEMENT_ID].childIds).toEqual(['a', 'b']);
    });
});
