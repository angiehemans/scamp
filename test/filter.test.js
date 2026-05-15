import { describe, it, expect } from 'vitest';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, } from '@lib/element';
import { DEFAULT_BREAKPOINTS } from '@shared/types';
const makeRoot = (childIds = []) => ({
    id: ROOT_ELEMENT_ID,
    type: 'rectangle',
    parentId: null,
    childIds,
    widthMode: 'stretch',
    widthValue: 1440,
    heightMode: 'auto',
    heightValue: 900,
    minHeight: '100vh',
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
const makeRect = (id, overrides = {}) => ({
    ...DEFAULT_RECT_STYLES,
    id,
    type: 'rectangle',
    parentId: ROOT_ELEMENT_ID,
    childIds: [],
    x: 0,
    y: 0,
    customProperties: {},
    ...overrides,
});
const BLUR = { kind: 'blur', value: 4 };
const BRIGHTNESS = { kind: 'brightness', value: 120 };
const GRAYSCALE = { kind: 'grayscale', value: 50 };
const HUE = { kind: 'hue-rotate', value: 90 };
describe('filter: generator', () => {
    it('omits the filter declaration when filters is empty', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect('a1b2'),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            breakpoints: DEFAULT_BREAKPOINTS,
            customMediaBlocks: [],
        });
        expect(css).not.toContain('filter:');
        expect(css).not.toContain('backdrop-filter:');
    });
    it('emits a single filter as the filter shorthand', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect('a1b2', { filters: [BLUR] }),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            breakpoints: DEFAULT_BREAKPOINTS,
            customMediaBlocks: [],
        });
        expect(css).toContain('filter: blur(4px);');
    });
    it('emits multiple filters space-separated, in order', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect('a1b2', {
                filters: [BLUR, BRIGHTNESS, GRAYSCALE],
            }),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            breakpoints: DEFAULT_BREAKPOINTS,
            customMediaBlocks: [],
        });
        expect(css).toContain('filter: blur(4px) brightness(120%) grayscale(50%);');
    });
    it('emits backdrop-filter independently from filter', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect('a1b2', {
                filters: [BLUR],
                backdropFilters: [BRIGHTNESS],
            }),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            breakpoints: DEFAULT_BREAKPOINTS,
            customMediaBlocks: [],
        });
        expect(css).toContain('filter: blur(4px);');
        expect(css).toContain('backdrop-filter: brightness(120%);');
    });
});
describe('filter: parser', () => {
    it('routes a parseable filter into the typed filters field', () => {
        const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
        const css = `.rect_a1b2 { filter: blur(4px); }`;
        const { elements } = parseCode(tsx, css);
        expect(elements['a1b2']?.filters).toEqual([BLUR]);
        expect(elements['a1b2']?.customProperties).toEqual({});
    });
    it('parses a multi-filter list back into the field in order', () => {
        const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
        const css = `.rect_a1b2 {
      filter: blur(4px) brightness(120%) grayscale(50%);
    }`;
        const { elements } = parseCode(tsx, css);
        expect(elements['a1b2']?.filters).toEqual([BLUR, BRIGHTNESS, GRAYSCALE]);
    });
    it('routes backdrop-filter into the typed backdropFilters field', () => {
        const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
        const css = `.rect_a1b2 { backdrop-filter: blur(12px); }`;
        const { elements } = parseCode(tsx, css);
        expect(elements['a1b2']?.backdropFilters).toEqual([
            { kind: 'blur', value: 12 },
        ]);
        expect(elements['a1b2']?.customProperties).toEqual({});
    });
    it('preserves an unparseable filter in customProperties', () => {
        const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
        const css = `.rect_a1b2 { filter: drop-shadow(0 4px 8px #000); }`;
        const { elements } = parseCode(tsx, css);
        expect(elements['a1b2']?.filters).toEqual([]);
        expect(elements['a1b2']?.customProperties).toEqual({
            filter: 'drop-shadow(0 4px 8px #000)',
        });
    });
    it('refuses partial parses to avoid silently dropping filters', () => {
        const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
        const css = `.rect_a1b2 { filter: blur(4px) drop-shadow(0 0 0); }`;
        const { elements } = parseCode(tsx, css);
        expect(elements['a1b2']?.filters).toEqual([]);
        expect(elements['a1b2']?.customProperties).toEqual({
            filter: 'blur(4px) drop-shadow(0 0 0)',
        });
    });
});
describe('filter: round-trip', () => {
    it('round-trips a multi-filter list with mixed kinds and units', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect('a1b2', {
                filters: [BLUR, BRIGHTNESS, HUE, GRAYSCALE],
                backdropFilters: [{ kind: 'blur', value: 12 }],
            }),
        };
        const { tsx, css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            breakpoints: DEFAULT_BREAKPOINTS,
            customMediaBlocks: [],
        });
        const { elements: parsed } = parseCode(tsx, css);
        expect(parsed['a1b2']?.filters).toEqual([
            BLUR,
            BRIGHTNESS,
            HUE,
            GRAYSCALE,
        ]);
        expect(parsed['a1b2']?.backdropFilters).toEqual([
            { kind: 'blur', value: 12 },
        ]);
    });
    it('round-trips empty lists as no declaration', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect('a1b2'),
        };
        const { tsx, css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            breakpoints: DEFAULT_BREAKPOINTS,
            customMediaBlocks: [],
        });
        const { elements: parsed } = parseCode(tsx, css);
        expect(parsed['a1b2']?.filters).toEqual([]);
        expect(parsed['a1b2']?.backdropFilters).toEqual([]);
        expect(css).not.toContain('filter:');
    });
});
describe('filter: state overrides', () => {
    it('emits and parses a hover-state filter override', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect('a1b2', {
                filters: [GRAYSCALE],
                stateOverrides: {
                    hover: {
                        filters: [BLUR, BRIGHTNESS],
                    },
                },
            }),
        };
        const { tsx, css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            breakpoints: DEFAULT_BREAKPOINTS,
            customMediaBlocks: [],
        });
        expect(css).toContain('.rect_a1b2:hover');
        expect(css).toMatch(/:hover[^}]*filter:\s*blur\(4px\) brightness\(120%\);/);
        const { elements: parsed } = parseCode(tsx, css);
        expect(parsed['a1b2']?.stateOverrides?.hover?.filters).toEqual([
            BLUR,
            BRIGHTNESS,
        ]);
    });
    it('emits filter: none to explicitly clear an inherited filter at a state', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect('a1b2', {
                filters: [BLUR],
                stateOverrides: {
                    hover: {
                        filters: [],
                    },
                },
            }),
        };
        const { tsx, css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            breakpoints: DEFAULT_BREAKPOINTS,
            customMediaBlocks: [],
        });
        expect(css).toMatch(/:hover[^}]*filter:\s*none;/);
        const { elements: parsed } = parseCode(tsx, css);
        expect(parsed['a1b2']?.stateOverrides?.hover?.filters).toEqual([]);
    });
    it('emits backdrop-filter: none to clear inherited backdrop-filter at a state', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect('a1b2', {
                backdropFilters: [{ kind: 'blur', value: 12 }],
                stateOverrides: {
                    hover: {
                        backdropFilters: [],
                        toggledOffGroups: [],
                    },
                },
            }),
        };
        const { tsx, css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            breakpoints: DEFAULT_BREAKPOINTS,
            customMediaBlocks: [],
        });
        expect(css).toMatch(/:hover[^}]*backdrop-filter:\s*none;/);
        const { elements: parsed } = parseCode(tsx, css);
        expect(parsed['a1b2']?.stateOverrides?.hover?.backdropFilters).toEqual([]);
    });
});
