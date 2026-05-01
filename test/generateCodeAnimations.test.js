import { describe, it, expect } from 'vitest';
import { generateCode } from '@lib/generateCode';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, } from '@lib/element';
const makeRoot = (childIds = []) => ({
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
const fadeInUpAnimation = {
    name: 'fade-in-up',
    isPreset: true,
    durationMs: 300,
    easing: 'ease',
    delayMs: 0,
    iterationCount: 1,
    direction: 'normal',
    fillMode: 'forwards',
    playState: 'running',
};
const FADE_IN_UP_BODY = `  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }`;
const fadeInUpKeyframesBlock = {
    name: 'fade-in-up',
    body: FADE_IN_UP_BODY,
    isPreset: true,
};
describe('generateCode — element-level animation shorthand', () => {
    it('emits the animation shorthand on an element with one set', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({ id: 'a1b2', animation: fadeInUpAnimation }),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            pageKeyframesBlocks: [fadeInUpKeyframesBlock],
        });
        expect(css).toContain('animation: fade-in-up 300ms ease forwards;');
    });
    it('omits the animation declaration when undefined', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({ id: 'a1b2' }),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        expect(css).not.toContain('animation:');
    });
});
describe('generateCode — page-level @keyframes blocks', () => {
    it('emits a @keyframes block from pageKeyframesBlocks', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({ id: 'a1b2', animation: fadeInUpAnimation }),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            pageKeyframesBlocks: [fadeInUpKeyframesBlock],
        });
        expect(css).toContain('@keyframes fade-in-up {');
        expect(css).toContain('opacity: 0; transform: translateY(16px)');
    });
    it('emits each keyframe block once even when multiple elements reference it', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2', 'c3d4']),
            a1b2: makeRect({ id: 'a1b2', animation: fadeInUpAnimation }),
            c3d4: makeRect({ id: 'c3d4', animation: fadeInUpAnimation }),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            // The store deduplicates by name on parse / when adding via
            // setAnimation; the generator trusts the input list.
            pageKeyframesBlocks: [fadeInUpKeyframesBlock],
        });
        const matches = css.match(/@keyframes fade-in-up/g);
        expect(matches?.length).toBe(1);
    });
    it('emits an agent-written keyframes block verbatim from the body field', () => {
        const customBlock = {
            name: 'my-custom',
            body: `  from { opacity: 0.3; }
  to { opacity: 1; }`,
            isPreset: false,
        };
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            pageKeyframesBlocks: [customBlock],
        });
        expect(css).toContain('@keyframes my-custom {');
        expect(css).toContain('opacity: 0.3');
    });
    it('keeps the keyframes block when no element references it (referenced or not)', () => {
        // Removing an animation from an element doesn't drop the
        // keyframes block — that's an explicit cleanup action, not
        // automatic, per the design.
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            pageKeyframesBlocks: [fadeInUpKeyframesBlock],
        });
        expect(css).toContain('@keyframes fade-in-up {');
    });
    it('emits keyframes BEFORE @media blocks in source order', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({
                id: 'a1b2',
                animation: fadeInUpAnimation,
                breakpointOverrides: { tablet: { padding: [12, 12, 12, 12] } },
            }),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            breakpoints: [
                { id: 'desktop', label: 'Desktop', width: 1440 },
                { id: 'tablet', label: 'Tablet', width: 768 },
            ],
            pageKeyframesBlocks: [fadeInUpKeyframesBlock],
        });
        const keyframesIdx = css.indexOf('@keyframes');
        const mediaIdx = css.indexOf('@media');
        expect(keyframesIdx).toBeGreaterThan(-1);
        expect(mediaIdx).toBeGreaterThan(keyframesIdx);
    });
});
describe('generateCode — animation inside :hover state block', () => {
    it('emits an animation declaration in the hover pseudo-class block', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({
                id: 'a1b2',
                stateOverrides: {
                    hover: {
                        animation: {
                            name: 'shake',
                            isPreset: true,
                            durationMs: 500,
                            easing: 'ease-in-out',
                            delayMs: 0,
                            iterationCount: 1,
                            direction: 'normal',
                            fillMode: 'none',
                            playState: 'running',
                        },
                    },
                },
            }),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        expect(css).toContain('.rect_a1b2:hover {');
        expect(css).toContain('animation: shake 500ms ease-in-out;');
    });
    it('emits both base and state animations as separate declarations', () => {
        const elements = {
            [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
            a1b2: makeRect({
                id: 'a1b2',
                animation: fadeInUpAnimation,
                stateOverrides: {
                    hover: {
                        animation: {
                            name: 'pulse',
                            isPreset: true,
                            durationMs: 1000,
                            easing: 'ease-in-out',
                            delayMs: 0,
                            iterationCount: 'infinite',
                            direction: 'normal',
                            fillMode: 'none',
                            playState: 'running',
                        },
                    },
                },
            }),
        };
        const { css } = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        expect(css).toContain('animation: fade-in-up 300ms ease forwards;');
        expect(css).toContain('animation: pulse 1s ease-in-out infinite;');
    });
});
