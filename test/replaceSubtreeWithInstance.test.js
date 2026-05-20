import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@store/canvasSlice';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID } from '@lib/element';
/**
 * Coverage for the canvas-store action that powers the
 * convert-to-component flow. Doesn't touch IPC — the on-disk
 * write is the caller's responsibility; this just verifies the
 * in-memory page mutation.
 */
const makeRoot = (childIds) => ({
    ...DEFAULT_RECT_STYLES,
    id: ROOT_ELEMENT_ID,
    type: 'rectangle',
    parentId: null,
    childIds,
    x: 0,
    y: 0,
    customProperties: {},
});
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
const seed = (elements) => {
    useCanvasStore.setState({
        elements,
        rootElementId: ROOT_ELEMENT_ID,
        selectedElementIds: [],
    });
};
describe('replaceSubtreeWithInstance', () => {
    beforeEach(() => {
        seed({ [ROOT_ELEMENT_ID]: makeRoot([]) });
    });
    it('returns null when the subtree root is missing', () => {
        const id = useCanvasStore
            .getState()
            .replaceSubtreeWithInstance('does-not-exist', 'Button');
        expect(id).toBeNull();
    });
    it('returns null when the subtree root IS the page root', () => {
        // Replacing the page root has no parent to splice into —
        // it'd orphan the page. Refuse.
        const id = useCanvasStore
            .getState()
            .replaceSubtreeWithInstance(ROOT_ELEMENT_ID, 'Button');
        expect(id).toBeNull();
        // Page root still present.
        expect(useCanvasStore.getState().elements[ROOT_ELEMENT_ID]).toBeDefined();
    });
    it('splices an instance element into the parent in the source subtree\'s position', () => {
        seed({
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2', 'g7h8', 'k9l0']),
            a1b2: makeRect({ id: 'a1b2' }),
            g7h8: makeRect({ id: 'g7h8', x: 100, y: 200 }),
            k9l0: makeRect({ id: 'k9l0' }),
        });
        const newId = useCanvasStore
            .getState()
            .replaceSubtreeWithInstance('g7h8', 'Card');
        expect(newId).not.toBeNull();
        const state = useCanvasStore.getState();
        // Source element removed.
        expect(state.elements['g7h8']).toBeUndefined();
        // New instance present + has the right shape.
        const instance = state.elements[newId];
        expect(instance).toBeDefined();
        expect(instance.type).toBe('component-instance');
        expect(instance.componentName).toBe('Card');
        // Position preserved.
        expect(instance.x).toBe(100);
        expect(instance.y).toBe(200);
        // Parent's childIds: order preserved, new id slots in at g7h8's spot.
        expect(state.elements[ROOT_ELEMENT_ID].childIds).toEqual([
            'a1b2',
            newId,
            'k9l0',
        ]);
    });
    it('removes every descendant of the subtree from the elements map', () => {
        seed({
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({ id: 'a1b2', childIds: ['c3d4'] }),
            c3d4: makeRect({
                id: 'c3d4',
                parentId: 'a1b2',
                childIds: ['e5f6'],
            }),
            e5f6: makeRect({ id: 'e5f6', parentId: 'c3d4' }),
        });
        useCanvasStore
            .getState()
            .replaceSubtreeWithInstance('a1b2', 'HeroCard');
        const state = useCanvasStore.getState();
        expect(state.elements['a1b2']).toBeUndefined();
        expect(state.elements['c3d4']).toBeUndefined();
        expect(state.elements['e5f6']).toBeUndefined();
    });
    it('leaves sibling elements untouched', () => {
        seed({
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2', 'g7h8']),
            a1b2: makeRect({ id: 'a1b2' }),
            g7h8: makeRect({ id: 'g7h8', backgroundColor: '#abcdef' }),
        });
        useCanvasStore
            .getState()
            .replaceSubtreeWithInstance('a1b2', 'Card');
        expect(useCanvasStore.getState().elements['g7h8']).toBeDefined();
        expect(useCanvasStore.getState().elements['g7h8'].backgroundColor).toBe('#abcdef');
    });
    it('selects the new instance', () => {
        seed({
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({ id: 'a1b2' }),
        });
        const newId = useCanvasStore
            .getState()
            .replaceSubtreeWithInstance('a1b2', 'Card');
        expect(useCanvasStore.getState().selectedElementIds).toEqual([newId]);
    });
});
