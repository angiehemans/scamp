import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@store/canvasSlice';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID } from '@lib/element';
/**
 * End-to-end tests of the store's state-aware patch routing. Verifies
 * that `patchElement` sends style fields to
 * `stateOverrides[activeStateName]` when a non-default state is
 * active, and keeps direct-manipulation gestures (move / resize) on
 * the base regardless of state.
 */
const rectId = 'a1b2';
const makeRect = (overrides = {}) => ({
    ...DEFAULT_RECT_STYLES,
    id: rectId,
    type: 'rectangle',
    parentId: ROOT_ELEMENT_ID,
    childIds: [],
    x: 0,
    y: 0,
    customProperties: {},
    ...overrides,
});
const resetStore = (el) => {
    useCanvasStore.setState({
        elements: {
            [ROOT_ELEMENT_ID]: {
                ...DEFAULT_RECT_STYLES,
                id: ROOT_ELEMENT_ID,
                type: 'rectangle',
                parentId: null,
                childIds: [el.id],
                x: 0,
                y: 0,
                customProperties: {},
            },
            [el.id]: el,
        },
        activeBreakpointId: 'desktop',
        activeStateName: null,
    });
};
describe('patchElement state routing', () => {
    beforeEach(() => {
        useCanvasStore.setState({
            activeBreakpointId: 'desktop',
            activeStateName: null,
        });
    });
    it('writes to top-level when active state is null', () => {
        resetStore(makeRect({ backgroundColor: '#ffffff' }));
        useCanvasStore.getState().patchElement(rectId, {
            backgroundColor: '#000000',
        });
        const el = useCanvasStore.getState().elements[rectId];
        expect(el?.backgroundColor).toBe('#000000');
        expect(el?.stateOverrides).toBeUndefined();
    });
    it('routes a style patch into stateOverrides.hover when hover is active', () => {
        resetStore(makeRect({ backgroundColor: '#ffffff' }));
        useCanvasStore.getState().setActiveState('hover');
        useCanvasStore.getState().patchElement(rectId, {
            backgroundColor: '#aaaaaa',
        });
        const el = useCanvasStore.getState().elements[rectId];
        // Base stays untouched.
        expect(el?.backgroundColor).toBe('#ffffff');
        expect(el?.stateOverrides?.hover?.backgroundColor).toBe('#aaaaaa');
    });
    it('keeps separate state buckets when switching between hover and active', () => {
        resetStore(makeRect({ backgroundColor: '#ffffff' }));
        useCanvasStore.getState().setActiveState('hover');
        useCanvasStore.getState().patchElement(rectId, {
            backgroundColor: '#aaaaaa',
        });
        useCanvasStore.getState().setActiveState('active');
        useCanvasStore.getState().patchElement(rectId, {
            backgroundColor: '#888888',
        });
        const el = useCanvasStore.getState().elements[rectId];
        expect(el?.stateOverrides?.hover?.backgroundColor).toBe('#aaaaaa');
        expect(el?.stateOverrides?.active?.backgroundColor).toBe('#888888');
    });
    it('merges customProperties object-wise inside a state override', () => {
        resetStore(makeRect());
        useCanvasStore.getState().setActiveState('hover');
        useCanvasStore.getState().patchElement(rectId, {
            customProperties: { transform: 'translateY(-2px)' },
        });
        useCanvasStore.getState().patchElement(rectId, {
            customProperties: { 'box-shadow': '0 4px 8px rgba(0,0,0,0.1)' },
        });
        const hover = useCanvasStore.getState().elements[rectId]?.stateOverrides?.hover;
        expect(hover?.customProperties).toEqual({
            transform: 'translateY(-2px)',
            'box-shadow': '0 4px 8px rgba(0,0,0,0.1)',
        });
    });
    it('routes identity / content fields to top-level even when a state is active', () => {
        resetStore(makeRect());
        useCanvasStore.getState().setActiveState('hover');
        useCanvasStore.getState().patchElement(rectId, {
            tag: 'button',
            attributes: { type: 'button' },
        });
        const el = useCanvasStore.getState().elements[rectId];
        expect(el?.tag).toBe('button');
        expect(el?.attributes?.type).toBe('button');
        // No stateOverrides should be created for identity fields.
        expect(el?.stateOverrides).toBeUndefined();
    });
    it('drops style patches at non-desktop breakpoint + non-default state (out of scope combo)', () => {
        resetStore(makeRect({ backgroundColor: '#ffffff' }));
        useCanvasStore.setState({
            activeBreakpointId: 'tablet',
            activeStateName: 'hover',
        });
        useCanvasStore.getState().patchElement(rectId, {
            backgroundColor: '#ff0000',
        });
        const el = useCanvasStore.getState().elements[rectId];
        // Combo is out of scope — patch is dropped on the floor for this
        // version (UI guards against this, so it shouldn't fire normally).
        expect(el?.backgroundColor).toBe('#ffffff');
        expect(el?.stateOverrides).toBeUndefined();
        expect(el?.breakpointOverrides?.tablet?.backgroundColor).toBeUndefined();
    });
});
describe('moveElement / resizeElement always land on the base', () => {
    beforeEach(() => {
        useCanvasStore.setState({
            activeBreakpointId: 'desktop',
            activeStateName: null,
        });
    });
    it('moveElement writes x/y to top-level even when hover is active', () => {
        resetStore(makeRect({ x: 0, y: 0 }));
        useCanvasStore.getState().setActiveState('hover');
        useCanvasStore.getState().moveElement(rectId, 50, 100);
        const el = useCanvasStore.getState().elements[rectId];
        expect(el?.x).toBe(50);
        expect(el?.y).toBe(100);
        expect(el?.stateOverrides).toBeUndefined();
    });
    it('resizeElement writes dimensions to top-level even when hover is active', () => {
        resetStore(makeRect({ widthValue: 100, heightValue: 100 }));
        useCanvasStore.getState().setActiveState('hover');
        useCanvasStore.getState().resizeElement(rectId, 0, 0, 200, 250);
        const el = useCanvasStore.getState().elements[rectId];
        expect(el?.widthValue).toBe(200);
        expect(el?.heightValue).toBe(250);
        expect(el?.stateOverrides).toBeUndefined();
    });
});
