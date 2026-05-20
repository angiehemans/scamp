import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@store/canvasSlice';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID } from '@lib/element';
/**
 * Phase 6 coverage: per-instance text overrides on a page. Covers
 * the canvas-store mutations (`setPropOverride` / `clearProp-
 * Override` / `setEditingInstanceProp`) plus the round-trip through
 * `generateCode` → `parseCode` for a page that hosts an instance
 * with one or more overrides set.
 */
const makePageRoot = (childIds = []) => ({
    ...DEFAULT_RECT_STYLES,
    id: ROOT_ELEMENT_ID,
    type: 'rectangle',
    parentId: null,
    childIds,
    widthMode: 'stretch',
    heightMode: 'auto',
    minHeight: '100vh',
    x: 0,
    y: 0,
    backgroundColor: '#ffffff',
    customProperties: {},
});
const makeInstance = (overrides) => ({
    ...DEFAULT_RECT_STYLES,
    type: 'component-instance',
    parentId: ROOT_ELEMENT_ID,
    childIds: [],
    widthMode: 'auto',
    heightMode: 'auto',
    x: 0,
    y: 0,
    customProperties: {},
    instanceId: `inst_${overrides.id}`,
    propOverrides: {},
    ...overrides,
});
describe('canvas store — setPropOverride / clearPropOverride', () => {
    beforeEach(() => {
        useCanvasStore.setState({
            elements: {
                [ROOT_ELEMENT_ID]: makePageRoot(['i1']),
                i1: makeInstance({ id: 'i1', componentName: 'Button' }),
            },
            rootElementId: ROOT_ELEMENT_ID,
            selectedElementIds: [],
        });
    });
    it('sets a prop override on a component-instance', () => {
        useCanvasStore.getState().setPropOverride('i1', 'label', 'Hi there');
        expect(useCanvasStore.getState().elements['i1'].propOverrides).toEqual({
            label: 'Hi there',
        });
    });
    it('updates an existing override in place (no key duplication)', () => {
        useCanvasStore.getState().setPropOverride('i1', 'label', 'first');
        useCanvasStore.getState().setPropOverride('i1', 'label', 'second');
        expect(useCanvasStore.getState().elements['i1'].propOverrides).toEqual({
            label: 'second',
        });
    });
    it('preserves an empty-string override as an explicit value, not absence', () => {
        useCanvasStore.getState().setPropOverride('i1', 'label', '');
        const map = useCanvasStore.getState().elements['i1'].propOverrides;
        // Explicit empty string is meaningful — distinct from absence
        // which means "use the component default". The data model
        // promises both to round-trip.
        expect(map).toHaveProperty('label', '');
    });
    it('is a no-op on a non-instance element', () => {
        useCanvasStore.setState({
            elements: {
                [ROOT_ELEMENT_ID]: makePageRoot(['r1']),
                r1: { ...makeInstance({ id: 'r1', componentName: 'Foo' }), type: 'rectangle' },
            },
        });
        useCanvasStore.getState().setPropOverride('r1', 'label', 'should not apply');
        expect(useCanvasStore.getState().elements['r1'].propOverrides).toEqual({});
    });
    it('clearPropOverride removes the key entirely', () => {
        useCanvasStore.setState({
            elements: {
                [ROOT_ELEMENT_ID]: makePageRoot(['i1']),
                i1: makeInstance({
                    id: 'i1',
                    componentName: 'Button',
                    propOverrides: { label: 'override-me' },
                }),
            },
        });
        useCanvasStore.getState().clearPropOverride('i1', 'label');
        expect(useCanvasStore.getState().elements['i1'].propOverrides).toEqual({});
    });
    it('clearPropOverride is a no-op when the key is absent', () => {
        useCanvasStore.getState().clearPropOverride('i1', 'doesNotExist');
        expect(useCanvasStore.getState().elements['i1'].propOverrides).toEqual({});
    });
});
describe('canvas store — setEditingInstanceProp', () => {
    beforeEach(() => {
        useCanvasStore.setState({
            editingInstanceProp: null,
        });
    });
    it('sets the editing target to the given instance/prop pair', () => {
        useCanvasStore
            .getState()
            .setEditingInstanceProp({ instanceId: 'i1', propName: 'label' });
        expect(useCanvasStore.getState().editingInstanceProp).toEqual({
            instanceId: 'i1',
            propName: 'label',
        });
    });
    it('clears the editing target when passed null', () => {
        useCanvasStore
            .getState()
            .setEditingInstanceProp({ instanceId: 'i1', propName: 'label' });
        useCanvasStore.getState().setEditingInstanceProp(null);
        expect(useCanvasStore.getState().editingInstanceProp).toBeNull();
    });
});
describe('generateCode → parseCode round-trip (page with instance overrides)', () => {
    it('preserves a propOverride through the page TSX/CSS round-trip', () => {
        const original = {
            [ROOT_ELEMENT_ID]: makePageRoot(['i1']),
            i1: makeInstance({
                id: 'i1',
                componentName: 'Button',
                propOverrides: { label: 'Click me!' },
            }),
        };
        const { tsx, css } = generateCode({
            elements: original,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        // Page TSX should carry the prop as a JSX attribute.
        expect(tsx).toContain('label="Click me!"');
        const parsed = parseCode(tsx, css);
        // After parsing, the override map should contain the value
        // verbatim. The canvas-element id derived from the
        // `data-scamp-instance-id` is the stable identifier.
        const reparsed = Object.values(parsed.elements).find((el) => el.type === 'component-instance');
        expect(reparsed).toBeDefined();
        expect(reparsed.propOverrides).toEqual({ label: 'Click me!' });
    });
    it('round-trips multiple overrides in the same instance', () => {
        const original = {
            [ROOT_ELEMENT_ID]: makePageRoot(['i1']),
            i1: makeInstance({
                id: 'i1',
                componentName: 'Card',
                propOverrides: { title: 'Welcome', body: 'Some body text' },
            }),
        };
        const { tsx, css } = generateCode({
            elements: original,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        const parsed = parseCode(tsx, css);
        const reparsed = Object.values(parsed.elements).find((el) => el.type === 'component-instance');
        expect(reparsed.propOverrides).toEqual({
            title: 'Welcome',
            body: 'Some body text',
        });
    });
});
