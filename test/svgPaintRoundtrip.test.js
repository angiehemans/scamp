import { describe, it, expect } from 'vitest';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from '@lib/defaults';
const makeRoot = (childIds) => ({
    ...DEFAULT_ROOT_STYLES,
    id: ROOT_ELEMENT_ID,
    type: 'rectangle',
    parentId: null,
    childIds,
    x: 0,
    y: 0,
    customProperties: {},
    inlineFragments: [],
});
const makeSvg = (overrides) => ({
    ...DEFAULT_RECT_STYLES,
    id: 'v001',
    type: 'image',
    tag: 'svg',
    parentId: ROOT_ELEMENT_ID,
    childIds: [],
    x: 0,
    y: 0,
    customProperties: {},
    ...overrides,
});
describe('svg paint round-trip', () => {
    it('fill / stroke / stroke-width + svgSource survive generateCode → parseCode', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['v001']),
            v001: makeSvg({
                fill: '#ff0000',
                stroke: 'currentColor',
                strokeWidth: 2,
                svgSource: '<path d="M0 0h10v10H0z" />',
                widthMode: 'fixed',
                widthValue: 24,
                heightMode: 'fixed',
                heightValue: 24,
            }),
        };
        const { tsx, css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        const parsed = parseCode(tsx, css);
        const svg = parsed.elements['v001'];
        expect(svg).toBeDefined();
        expect(svg.fill).toBe('#ff0000');
        expect(svg.stroke).toBe('currentColor');
        expect(svg.strokeWidth).toBe(2);
        expect(svg.tag).toBe('svg');
        expect(svg.svgSource).toContain('<path');
    });
    it('an unpainted svg parses with no paint fields', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['v001']),
            v001: makeSvg({ svgSource: '<circle r="5" />' }),
        };
        const { tsx, css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        const parsed = parseCode(tsx, css);
        const svg = parsed.elements['v001'];
        expect(svg.fill).toBeUndefined();
        expect(svg.stroke).toBeUndefined();
        expect(svg.strokeWidth).toBeUndefined();
    });
});
