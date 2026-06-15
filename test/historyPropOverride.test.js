import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@store/canvasSlice';
import { useHistoryStore } from '@store/historySlice';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID } from '@lib/element';
/**
 * Phase 5.5 acceptance: an instance prop-override edit pushes onto the
 * undo stack, and that entry survives navigating away from the page and
 * back, so Cmd+Z rolls the override back. (The audit found instance
 * prop-override edits already push `patch ['propOverrides']`; this locks
 * that behavior in.)
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
const makeInstance = (id) => ({
    ...DEFAULT_RECT_STYLES,
    id,
    type: 'component-instance',
    parentId: ROOT_ELEMENT_ID,
    childIds: [],
    widthMode: 'auto',
    heightMode: 'auto',
    x: 0,
    y: 0,
    customProperties: {},
    instanceId: `inst_${id}`,
    componentName: 'Button',
    propOverrides: {},
});
describe('history — instance prop override is undoable across navigation (5.5)', () => {
    beforeEach(() => {
        useHistoryStore.setState({
            perPage: {},
            activePageId: null,
            transactionDepth: 0,
            pendingExternalEdit: null,
            restoreSnapshot: null,
        });
        // Wire restore the same way initSyncBridge does at runtime.
        useHistoryStore.getState().setRestoreSnapshot((snapshot) => {
            useCanvasStore.setState({ elements: snapshot });
        });
        useCanvasStore.setState({
            elements: {
                [ROOT_ELEMENT_ID]: makePageRoot(['i1']),
                i1: makeInstance('i1'),
            },
            rootElementId: ROOT_ELEMENT_ID,
            selectedElementIds: [],
        });
    });
    it('rolls the override back after navigating away and back, then undo', () => {
        const hist = useHistoryStore.getState();
        hist.setActivePageId('app/home/page.tsx');
        hist.commitInitialIfEmpty(useCanvasStore.getState().elements);
        useCanvasStore.getState().setPropOverride('i1', 'label', 'Hi there');
        expect(useCanvasStore.getState().elements['i1'].propOverrides).toEqual({
            label: 'Hi there',
        });
        // Navigate away to another page and back — the home bucket must
        // survive so its undo stack is intact on return.
        hist.setActivePageId('app/about/page.tsx');
        hist.setActivePageId('app/home/page.tsx');
        useHistoryStore.getState().undo();
        expect(useCanvasStore.getState().elements['i1'].propOverrides).toEqual({});
    });
    it('redo re-applies the override', () => {
        const hist = useHistoryStore.getState();
        hist.setActivePageId('app/home/page.tsx');
        hist.commitInitialIfEmpty(useCanvasStore.getState().elements);
        useCanvasStore.getState().setPropOverride('i1', 'label', 'Hi');
        useHistoryStore.getState().undo();
        expect(useCanvasStore.getState().elements['i1'].propOverrides).toEqual({});
        useHistoryStore.getState().redo();
        expect(useCanvasStore.getState().elements['i1'].propOverrides).toEqual({
            label: 'Hi',
        });
    });
});
