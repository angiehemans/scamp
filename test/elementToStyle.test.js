import { describe, it, expect } from 'vitest';
import { elementToStyle, canvasRenderTag, CANVAS_SKIP_ATTRS_BY_TAG, } from '@lib/elementToStyle';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID } from '@lib/element';
const makeEl = (overrides = {}) => ({
    ...DEFAULT_RECT_STYLES,
    id: 'rect_a1b2',
    type: 'rectangle',
    parentId: ROOT_ELEMENT_ID,
    childIds: [],
    x: 0,
    y: 0,
    minHeight: '100vh',
    customProperties: {},
    ...overrides,
});
const style = (el, o = {}) => elementToStyle(el, o.parentDisplay, o.parentDirection, o.tokens ?? [], null, 'nextjs', o.isInstanceInner ?? false, o.rootMinHeight ?? 900, o.inComponentEditor ?? false);
describe('canvasRenderTag', () => {
    it('swaps dialog and svg for div (a real one would interfere with the canvas)', () => {
        expect(canvasRenderTag('dialog')).toBe('div');
        expect(canvasRenderTag('svg')).toBe('div');
    });
    it('passes every other tag through unchanged', () => {
        expect(canvasRenderTag('div')).toBe('div');
        expect(canvasRenderTag('span')).toBe('span');
        expect(canvasRenderTag('button')).toBe('button');
    });
});
describe('CANVAS_SKIP_ATTRS_BY_TAG', () => {
    it('skips the side-effecting attributes per tag', () => {
        expect(CANVAS_SKIP_ATTRS_BY_TAG.a?.has('href')).toBe(true);
        expect(CANVAS_SKIP_ATTRS_BY_TAG.a?.has('target')).toBe(true);
        expect(CANVAS_SKIP_ATTRS_BY_TAG.dialog?.has('open')).toBe(true);
        expect(CANVAS_SKIP_ATTRS_BY_TAG.form?.has('action')).toBe(true);
        expect(CANVAS_SKIP_ATTRS_BY_TAG.button?.has('type')).toBe(true);
    });
    it('has no entry for tags without side effects', () => {
        expect(CANVAS_SKIP_ATTRS_BY_TAG.div).toBeUndefined();
    });
});
describe('elementToStyle — width/height modes', () => {
    it('fixed mode uses the numeric value (React appends px)', () => {
        expect(style(makeEl({ widthMode: 'fixed', widthValue: 120 })).width).toBe(120);
        expect(style(makeEl({ heightMode: 'fixed', heightValue: 64 })).height).toBe(64);
    });
    it('a verbatim widthCustom wins over the px fallback in fixed mode', () => {
        expect(style(makeEl({ widthMode: 'fixed', widthCustom: '50vh' })).width).toBe('50vh');
    });
    it('stretch maps to 100% outside a flex parent', () => {
        expect(style(makeEl({ widthMode: 'stretch' })).width).toBe('100%');
    });
    it('fit-content maps to the keyword', () => {
        expect(style(makeEl({ widthMode: 'fit-content' })).width).toBe('fit-content');
    });
    it('auto produces undefined so the element inherits the browser default', () => {
        expect(style(makeEl({ widthMode: 'auto' })).width).toBeUndefined();
    });
});
describe('elementToStyle — component-editor root vs. the canvas (viewport resize)', () => {
    const rootEl = (overrides = {}) => makeEl({ id: ROOT_ELEMENT_ID, parentId: null, ...overrides });
    it('a non-fixed root fills the canvas via min-height and drops its own height', () => {
        const s = style(rootEl({ heightMode: 'auto' }), {
            rootMinHeight: 800,
            inComponentEditor: true,
        });
        expect(s.height).toBeUndefined();
        expect(s.minHeight).toBe('800px');
    });
    it('a stretch root still reflows — min-height tracks the canvas', () => {
        expect(style(rootEl({ heightMode: 'stretch' }), {
            rootMinHeight: 400,
            inComponentEditor: true,
        }).minHeight).toBe('400px');
        expect(style(rootEl({ heightMode: 'stretch' }), {
            rootMinHeight: 700,
            inComponentEditor: true,
        }).minHeight).toBe('700px');
    });
    it('a fixed-height root keeps its own height and gets no canvas min-height', () => {
        const s = style(rootEl({ heightMode: 'fixed', heightValue: 200 }), {
            rootMinHeight: 800,
            inComponentEditor: true,
        });
        expect(s.height).toBe(200);
        expect(s.minHeight).toBeUndefined();
    });
    it('a fixed-height root does NOT grow when the canvas (rootMinHeight) grows', () => {
        const small = style(rootEl({ heightMode: 'fixed', heightValue: 200 }), {
            rootMinHeight: 300,
            inComponentEditor: true,
        });
        const large = style(rootEl({ heightMode: 'fixed', heightValue: 200 }), {
            rootMinHeight: 900,
            inComponentEditor: true,
        });
        expect(small.height).toBe(200);
        expect(large.height).toBe(200);
        expect(small.minHeight).toBeUndefined();
        expect(large.minHeight).toBeUndefined();
    });
    it('but on the PAGE (not the component editor) a fixed-height root still grows via min-height', () => {
        const s = style(rootEl({ heightMode: 'fixed', heightValue: 200 }), {
            rootMinHeight: 800,
            inComponentEditor: false,
        });
        expect(s.height).toBeUndefined();
        expect(s.minHeight).toBe('800px');
    });
});
describe('elementToStyle — flex parent stretch routing', () => {
    it('main-axis stretch in a row parent becomes flex:1 and drops the size', () => {
        const s = style(makeEl({ widthMode: 'stretch' }), {
            parentDisplay: 'flex',
            parentDirection: 'row',
        });
        expect(s.flex).toBe(1);
        expect(s.minWidth).toBe(0);
        expect(s.width).toBeUndefined();
    });
    it('cross-axis (block) stretch in a row parent becomes align-self:stretch', () => {
        // Cross axis of a row is the BLOCK axis (height); `height: 100%`
        // collapses against an indefinite container height, so we fall back
        // to align-self:stretch.
        const s = style(makeEl({ heightMode: 'stretch' }), {
            parentDisplay: 'flex',
            parentDirection: 'row',
        });
        expect(s.alignSelf).toBe('stretch');
        expect(s.height).toBeUndefined();
    });
    it('cross-axis (inline) stretch in a column parent keeps width:100% and does NOT set align-self', () => {
        // Cross axis of a column is the INLINE axis (width); `width: 100%`
        // resolves against the definite container width. Keeping it (rather
        // than align-self:stretch) lets the parent's align-items position the
        // item — e.g. `align-items: center` + a child `max-width` centres it,
        // matching the browser/preview. Regression for the html-test feed
        // rendering left-aligned on the canvas while centred in the preview.
        const s = style(makeEl({ widthMode: 'stretch' }), {
            parentDisplay: 'flex',
            parentDirection: 'column',
        });
        expect(s.width).toBe('100%');
        expect(s.alignSelf).toBeUndefined();
    });
});
describe('elementToStyle — root vs instance-inner', () => {
    it('the page root renders without a fixed height (it grows via min-height)', () => {
        const rootEl = makeEl({ id: ROOT_ELEMENT_ID, heightMode: 'fixed', heightValue: 300 });
        expect(style(rootEl).height).toBeUndefined();
    });
    it('a non-root element keeps its fixed height', () => {
        const el = makeEl({ heightMode: 'fixed', heightValue: 300 });
        expect(style(el).height).toBe(300);
    });
    it('the same root id rendered as an instance-inner subtree is NOT treated as root', () => {
        const rootEl = makeEl({ id: ROOT_ELEMENT_ID, heightMode: 'fixed', heightValue: 300 });
        expect(style(rootEl, { isInstanceInner: true }).height).toBe(300);
    });
});
describe('elementToStyle — theme token resolution', () => {
    it('resolves a var(--token) font-family against the theme tokens', () => {
        const tokens = [
            { name: '--font-sans', value: 'Inter, sans-serif' },
        ];
        const el = makeEl({ type: 'text', text: 'hi', fontFamily: 'var(--font-sans)' });
        expect(style(el, { tokens }).fontFamily).toBe('Inter, sans-serif');
    });
    it('leaves an unknown token as the raw value (browser falls back)', () => {
        const el = makeEl({ type: 'text', text: 'hi', fontFamily: 'var(--missing)' });
        expect(style(el, { tokens: [] }).fontFamily).toBe('var(--missing)');
    });
});
