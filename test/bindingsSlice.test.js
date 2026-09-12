import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@store/canvasSlice';
import { useHistoryStore } from '@store/historySlice';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID } from '@lib/element';
/**
 * The bindings store slice behind the Data tab: attribute, event,
 * repeat, and show, plus the samples they seed on the root and the
 * rename that follows a prop everywhere. see docs/notes/view-bindings.md
 */
const HISTORY_ID = '/p/Card.tsx';
const rect = (id, extra = {}) => ({
    ...DEFAULT_RECT_STYLES,
    id,
    type: 'rectangle',
    parentId: ROOT_ELEMENT_ID,
    childIds: [],
    x: 0,
    y: 0,
    customProperties: {},
    inlineFragments: [],
    ...extra,
});
const seed = (extra, samples) => {
    useCanvasStore.setState({
        elements: {
            [ROOT_ELEMENT_ID]: {
                ...DEFAULT_ROOT_STYLES,
                id: ROOT_ELEMENT_ID,
                type: 'rectangle',
                parentId: null,
                childIds: Object.keys(extra),
                x: 0,
                y: 0,
                customProperties: {},
                inlineFragments: [],
                ...(samples ? { samples } : {}),
            },
            ...extra,
        },
        rootElementId: ROOT_ELEMENT_ID,
        selectedElementIds: [],
        activePage: null,
        activeComponent: { name: 'Card', kind: 'component', tsxPath: HISTORY_ID, cssPath: '/p/Card.css' },
        snapshotPreview: null,
    });
    useHistoryStore.setState({
        perPage: { [HISTORY_ID]: { entries: [], cursor: -1 } },
        activePageId: HISTORY_ID,
        transactionDepth: 0,
    });
};
const el = (id) => {
    const e = useCanvasStore.getState().elements[id];
    if (!e)
        throw new Error(`missing ${id}`);
    return e;
};
const historyLength = () => useHistoryStore.getState().perPage[HISTORY_ID]?.entries.length ?? 0;
describe('setAttributeBinding', () => {
    beforeEach(() => seed({ a: rect('a', { type: 'text', tag: 'a', text: 'Home', attributes: { href: 'https://x' } }) }));
    it('binds, inverts, and unbinds, committing history each time', () => {
        const s = useCanvasStore.getState();
        s.setAttributeBinding('a', 'href', 'url');
        expect(el('a').bind).toEqual({ href: 'url' });
        s.setAttributeBinding('a', 'disabled', 'canStart', true);
        expect(el('a').bind).toEqual({ href: 'url', disabled: '!canStart' });
        s.setAttributeBinding('a', 'href', null);
        expect(el('a').bind).toEqual({ disabled: '!canStart' });
        s.setAttributeBinding('a', 'disabled', null);
        expect(el('a').bind).toBeUndefined();
        // Consecutive patches of one field coalesce; at least one entry lands.
        expect(historyLength()).toBeGreaterThanOrEqual(1);
    });
    it('ignores a no-op', () => {
        useCanvasStore.getState().setAttributeBinding('a', 'href', null);
        expect(historyLength()).toBe(0);
    });
});
describe('setEventBinding', () => {
    beforeEach(() => seed({ b: rect('b', { type: 'text', tag: 'button', text: 'Go' }) }));
    it('binds and unbinds a handler', () => {
        const s = useCanvasStore.getState();
        s.setEventBinding('b', 'onClick', 'onStart');
        expect(el('b').on).toEqual({ onClick: 'onStart' });
        s.setEventBinding('b', 'onClick', null);
        expect(el('b').on).toBeUndefined();
    });
});
describe('setRepeat', () => {
    beforeEach(() => seed({ row: rect('row') }));
    it('seeds one sample row, keeps a non-default key, and drops the default key', () => {
        const s = useCanvasStore.getState();
        s.setRepeat('row', { over: 'items', as: 'item' });
        expect(el('row').repeat).toEqual({ over: 'items', as: 'item' });
        expect(el(ROOT_ELEMENT_ID).samples).toEqual({ items: [{ id: '1' }] });
        s.setRepeat('row', { over: 'items', as: 'item', key: 'slug' });
        expect(el('row').repeat).toEqual({ over: 'items', as: 'item', key: 'slug' });
        s.setRepeat('row', { over: 'items', as: 'item', key: 'id' });
        expect(el('row').repeat).toEqual({ over: 'items', as: 'item' });
    });
    it('keeps existing rows when re-pointed at the same list, and drops orphaned rows', () => {
        const s = useCanvasStore.getState();
        s.setRepeat('row', { over: 'items', as: 'item' });
        s.setSampleRows('items', [{ id: '1', label: 'A' }, { id: '2', label: 'B' }]);
        s.setRepeat('row', { over: 'items', as: 'thing' });
        expect(el(ROOT_ELEMENT_ID).samples?.['items']).toHaveLength(2);
        s.setRepeat('row', null);
        expect(el('row').repeat).toBeUndefined();
        expect(el(ROOT_ELEMENT_ID).samples).toBeUndefined();
    });
    it('never repeats the root', () => {
        useCanvasStore.getState().setRepeat(ROOT_ELEMENT_ID, { over: 'items', as: 'item' });
        expect(el(ROOT_ELEMENT_ID).repeat).toBeUndefined();
        expect(historyLength()).toBe(0);
    });
});
describe('setShowIf / setSampleFlag', () => {
    beforeEach(() => seed({ note: rect('note') }));
    it('seeds the flag true, toggles the sample, and drops the flag when cleared', () => {
        const s = useCanvasStore.getState();
        s.setShowIf('note', 'visible');
        expect(el('note').showIf).toBe('visible');
        expect(el(ROOT_ELEMENT_ID).samples).toEqual({ visible: true });
        s.setSampleFlag('visible', false);
        expect(el(ROOT_ELEMENT_ID).samples).toEqual({ visible: false });
        s.setShowIf('note', null);
        expect(el('note').showIf).toBeUndefined();
        expect(el(ROOT_ELEMENT_ID).samples).toBeUndefined();
    });
    it('keeps a flag another element still uses', () => {
        seed({ a: rect('a'), b: rect('b') });
        const s = useCanvasStore.getState();
        s.setShowIf('a', 'visible');
        s.setShowIf('b', 'visible');
        s.setShowIf('a', null);
        expect(el(ROOT_ELEMENT_ID).samples).toEqual({ visible: true });
    });
});
describe('renameBindingProp', () => {
    it('follows a prop through bindings, handlers, flags, lists, and samples', () => {
        seed({
            a: rect('a', { bind: { href: 'url' }, on: { onClick: 'go' } }),
            n: rect('n', { showIf: '!url' }),
            r: rect('r', { repeat: { over: 'url', as: 'u' } }),
        }, { url: [{ id: '1' }] });
        useCanvasStore.getState().renameBindingProp('url', 'link');
        expect(el('a').bind).toEqual({ href: 'link' });
        expect(el('a').on).toEqual({ onClick: 'go' });
        expect(el('n').showIf).toBe('!link');
        expect(el('r').repeat).toEqual({ over: 'link', as: 'u' });
        expect(el(ROOT_ELEMENT_ID).samples).toEqual({ link: [{ id: '1' }] });
        useCanvasStore.getState().renameBindingProp('go', 'onGo');
        expect(el('a').on).toEqual({ onClick: 'onGo' });
        expect(historyLength()).toBeGreaterThanOrEqual(1);
    });
    it('is a no-op for an unknown or unchanged name', () => {
        seed({ a: rect('a', { bind: { href: 'url' } }) });
        useCanvasStore.getState().renameBindingProp('nope', 'x');
        useCanvasStore.getState().renameBindingProp('url', 'url');
        expect(historyLength()).toBe(0);
    });
});
