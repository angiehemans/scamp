import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@store/canvasSlice';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID } from '@lib/element';
/**
 * Coverage for the canvas store's `insertComponentInstance`
 * action — Phase 3's drop-handler entry point. Sets up the store
 * with a single root element, then verifies the action inserts a
 * properly-shaped component-instance into the tree.
 */
const makeRoot = () => ({
    ...DEFAULT_RECT_STYLES,
    id: ROOT_ELEMENT_ID,
    type: 'rectangle',
    parentId: null,
    childIds: [],
    x: 0,
    y: 0,
    customProperties: {},
});
const reset = () => {
    useCanvasStore.setState({
        elements: { [ROOT_ELEMENT_ID]: makeRoot() },
        rootElementId: ROOT_ELEMENT_ID,
        selectedElementIds: [],
    });
};
describe('insertComponentInstance', () => {
    beforeEach(() => {
        reset();
    });
    it('inserts a component-instance element under the given parent', () => {
        const id = useCanvasStore.getState().insertComponentInstance({
            parentId: ROOT_ELEMENT_ID,
            componentName: 'Button',
            x: 50,
            y: 120,
        });
        expect(id).not.toBeNull();
        const state = useCanvasStore.getState();
        const inserted = state.elements[id];
        expect(inserted).toBeDefined();
        expect(inserted.type).toBe('component-instance');
        expect(inserted.componentName).toBe('Button');
        expect(inserted.x).toBe(50);
        expect(inserted.y).toBe(120);
        expect(inserted.parentId).toBe(ROOT_ELEMENT_ID);
    });
    it('appends the new id to the parent\'s childIds', () => {
        const id = useCanvasStore.getState().insertComponentInstance({
            parentId: ROOT_ELEMENT_ID,
            componentName: 'Card',
            x: 0,
            y: 0,
        });
        const root = useCanvasStore.getState().elements[ROOT_ELEMENT_ID];
        expect(root.childIds).toContain(id);
    });
    it('generates an instanceId of the form `inst_<hex>`', () => {
        const id = useCanvasStore.getState().insertComponentInstance({
            parentId: ROOT_ELEMENT_ID,
            componentName: 'Button',
            x: 0,
            y: 0,
        });
        const inserted = useCanvasStore.getState().elements[id];
        expect(inserted.instanceId).toBe(`inst_${id}`);
    });
    it('starts with an empty propOverrides map', () => {
        const id = useCanvasStore.getState().insertComponentInstance({
            parentId: ROOT_ELEMENT_ID,
            componentName: 'Button',
            x: 0,
            y: 0,
        });
        const inserted = useCanvasStore.getState().elements[id];
        expect(inserted.propOverrides).toEqual({});
    });
    it('defaults width/height to auto so the rendered component drives the box', () => {
        const id = useCanvasStore.getState().insertComponentInstance({
            parentId: ROOT_ELEMENT_ID,
            componentName: 'Button',
            x: 0,
            y: 0,
        });
        const inserted = useCanvasStore.getState().elements[id];
        expect(inserted.widthMode).toBe('auto');
        expect(inserted.heightMode).toBe('auto');
    });
    it('selects the newly inserted instance', () => {
        const id = useCanvasStore.getState().insertComponentInstance({
            parentId: ROOT_ELEMENT_ID,
            componentName: 'Button',
            x: 0,
            y: 0,
        });
        expect(useCanvasStore.getState().selectedElementIds).toEqual([id]);
    });
    it('returns null and is a no-op when the parent is missing', () => {
        const id = useCanvasStore.getState().insertComponentInstance({
            parentId: 'does-not-exist',
            componentName: 'Button',
            x: 0,
            y: 0,
        });
        expect(id).toBeNull();
        // Root unchanged.
        const root = useCanvasStore.getState().elements[ROOT_ELEMENT_ID];
        expect(root.childIds).toEqual([]);
    });
});
