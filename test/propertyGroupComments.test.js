import { describe, it, expect } from 'vitest';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID } from '@lib/element';
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
describe('generateCode — toggled-off groups emit a comment block', () => {
    it('comments out box-shadow when the shadow group is off', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({
                id: 'a1b2',
                boxShadows: [
                    {
                        offsetX: 0,
                        offsetY: 4,
                        blur: 8,
                        spread: 0,
                        color: 'rgba(0, 0, 0, 0.15)',
                        inset: false,
                    },
                ],
                toggledOffGroups: ['shadow'],
            }),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        expect(css).toContain('/* shadow off */');
        expect(css).toMatch(/\/\* box-shadow:.*\*\//);
        // The active block should not contain a live box-shadow declaration
        // for this class.
        const block = css
            .split('.rect_a1b2 {')[1]
            .split('}')[0];
        expect(block).not.toMatch(/^\s*box-shadow:/m);
    });
    it('routes background customProperties into the background comment block', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({
                id: 'a1b2',
                backgroundColor: '#ff0000',
                customProperties: {
                    'background-image': 'url("./assets/hero.png")',
                    'background-size': 'cover',
                },
                toggledOffGroups: ['background'],
            }),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        expect(css).toContain('/* background off */');
        expect(css).toMatch(/\/\* background:\s*#ff0000;\s*\*\//);
        expect(css).toMatch(/\/\* background-image:\s*url\("\.\/assets\/hero\.png"\);\s*\*\//);
        expect(css).toMatch(/\/\* background-size:\s*cover;\s*\*\//);
    });
    it('emits multiple group labels when several groups are off', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({
                id: 'a1b2',
                boxShadows: [
                    {
                        offsetX: 0,
                        offsetY: 4,
                        blur: 8,
                        spread: 0,
                        color: 'rgba(0, 0, 0, 0.15)',
                        inset: false,
                    },
                ],
                backgroundColor: '#abcdef',
                toggledOffGroups: ['background', 'shadow'],
            }),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        expect(css).toContain('/* background off */');
        expect(css).toContain('/* shadow off */');
    });
});
describe('parseCode — toggled-off group comment blocks round-trip', () => {
    it('reads `/* shadow off */` comment back into toggledOffGroups', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({
                id: 'a1b2',
                boxShadows: [
                    {
                        offsetX: 0,
                        offsetY: 4,
                        blur: 8,
                        spread: 0,
                        color: 'rgba(0, 0, 0, 0.15)',
                        inset: false,
                    },
                ],
                toggledOffGroups: ['shadow'],
            }),
        };
        const { tsx, css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        const parsed = parseCode(tsx, css);
        const a1b2 = parsed.elements['a1b2'];
        expect(a1b2).toBeDefined();
        expect(a1b2.toggledOffGroups).toEqual(['shadow']);
        expect(a1b2.boxShadows).toEqual(elements.a1b2.boxShadows);
    });
    it('round-trips multiple toggled-off groups (alphabetised)', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({
                id: 'a1b2',
                backgroundColor: '#cccccc',
                boxShadows: [
                    {
                        offsetX: 0,
                        offsetY: 2,
                        blur: 4,
                        spread: 0,
                        color: '#000000',
                        inset: false,
                    },
                ],
                toggledOffGroups: ['background', 'shadow'],
            }),
        };
        const { tsx, css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        const parsed = parseCode(tsx, css);
        expect(parsed.elements['a1b2'].toggledOffGroups).toEqual([
            'background',
            'shadow',
        ]);
    });
    it('preserves customProperties that were commented out under background off', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({
                id: 'a1b2',
                backgroundColor: '#ff0000',
                customProperties: {
                    'background-image': 'url("./hero.png")',
                    'background-size': 'cover',
                },
                toggledOffGroups: ['background'],
            }),
        };
        const { tsx, css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        const parsed = parseCode(tsx, css);
        const a1b2 = parsed.elements['a1b2'];
        expect(a1b2.toggledOffGroups).toEqual(['background']);
        expect(a1b2.backgroundColor).toBe('#ff0000');
        expect(a1b2.customProperties['background-image']).toBe('url("./hero.png")');
        expect(a1b2.customProperties['background-size']).toBe('cover');
    });
    it('round-trips an element with no toggled-off groups (no label emitted)', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({
                id: 'a1b2',
                backgroundColor: '#aabbcc',
            }),
        };
        const { tsx, css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        expect(css).not.toContain(' off */');
        const parsed = parseCode(tsx, css);
        expect(parsed.elements['a1b2'].toggledOffGroups).toEqual([]);
    });
    it('full state round-trips through generate → parse', () => {
        // Use auto width/height so the parser's "no width/height decl
        // means auto" fallback matches what we emit (otherwise the
        // round-trip flips widthMode from `fixed` → `auto`).
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({
                id: 'a1b2',
                widthMode: 'auto',
                heightMode: 'auto',
                boxShadows: [
                    {
                        offsetX: 0,
                        offsetY: 4,
                        blur: 8,
                        spread: 0,
                        color: 'rgba(0, 0, 0, 0.15)',
                        inset: false,
                    },
                ],
                filters: [{ kind: 'blur', value: 4 }],
                toggledOffGroups: ['filters', 'shadow'],
            }),
        };
        const { tsx, css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        const parsed = parseCode(tsx, css);
        expect(parsed.elements['a1b2']).toEqual(elements.a1b2);
    });
});
