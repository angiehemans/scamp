import { describe, it, expect } from 'vitest';
import { generateCode } from '@lib/generateCode';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';

const makeRoot = (childIds: string[] = []): ScampElement => ({
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

const makeRect = (
  overrides: Partial<ScampElement> & { id: string }
): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  type: 'rectangle',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  ...overrides,
});

describe('generateCode — state pseudo-class blocks', () => {
  it('emits a hover block right after the base block for the element', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        backgroundColor: '#ffffff',
        stateOverrides: {
          hover: { backgroundColor: '#f0f0f0' },
        },
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    // The hover block follows the base block, separated by a blank line.
    expect(css).toContain('.rect_a1b2:hover {\n  background: #f0f0f0;\n}');
    // Base block emits its background; hover block doesn't repeat it
    // unless the hover override sets a different value (which it does here).
    const hoverIndex = css.indexOf('.rect_a1b2:hover');
    const baseIndex = css.indexOf('.rect_a1b2 {');
    expect(baseIndex).toBeGreaterThan(-1);
    expect(hoverIndex).toBeGreaterThan(baseIndex);
  });

  it('emits states in fixed hover → active → focus order', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      // Set in deliberately weird order to confirm we still emit
      // hover → active → focus.
      a1b2: makeRect({
        id: 'a1b2',
        stateOverrides: {
          focus: { borderColor: '#0000ff' },
          active: { backgroundColor: '#888888' },
          hover: { backgroundColor: '#aaaaaa' },
        },
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    const hoverIdx = css.indexOf(':hover');
    const activeIdx = css.indexOf(':active');
    const focusIdx = css.indexOf(':focus');
    expect(hoverIdx).toBeGreaterThan(-1);
    expect(activeIdx).toBeGreaterThan(hoverIdx);
    expect(focusIdx).toBeGreaterThan(activeIdx);
  });

  it('skips empty / undefined state keys silently', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        stateOverrides: {
          hover: {}, // present but empty — should not emit
          active: { backgroundColor: '#888888' },
          // focus absent
        },
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(css).not.toContain(':hover');
    expect(css).toContain('.rect_a1b2:active');
    expect(css).not.toContain(':focus');
  });

  it('emits no state block when stateOverrides is undefined', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', backgroundColor: '#ffffff' }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(css).not.toContain(':hover');
    expect(css).not.toContain(':active');
    expect(css).not.toContain(':focus');
  });

  it('groups state blocks per element rather than collecting all hovers together', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2', 'c3d4']),
      a1b2: makeRect({
        id: 'a1b2',
        stateOverrides: { hover: { backgroundColor: '#aaaaaa' } },
      }),
      c3d4: makeRect({
        id: 'c3d4',
        stateOverrides: { hover: { backgroundColor: '#bbbbbb' } },
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    // Order: .rect_a1b2 base, .rect_a1b2:hover, .rect_c3d4 base, .rect_c3d4:hover
    const a1Base = css.indexOf('.rect_a1b2 {');
    const a1Hover = css.indexOf('.rect_a1b2:hover');
    const c3Base = css.indexOf('.rect_c3d4 {');
    const c3Hover = css.indexOf('.rect_c3d4:hover');
    expect(a1Base).toBeLessThan(a1Hover);
    expect(a1Hover).toBeLessThan(c3Base);
    expect(c3Base).toBeLessThan(c3Hover);
  });

  it('emits customSelectorBlocks after recognised state blocks for the same element', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        stateOverrides: { hover: { backgroundColor: '#aaaaaa' } },
        customSelectorBlocks: [
          {
            selector: '.rect_a1b2:focus-visible',
            body: '  outline: 2px solid #0080ff;',
          },
        ],
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    const hoverIdx = css.indexOf(':hover');
    const fvIdx = css.indexOf(':focus-visible');
    expect(hoverIdx).toBeGreaterThan(-1);
    expect(fvIdx).toBeGreaterThan(hoverIdx);
    expect(css).toContain('outline: 2px solid #0080ff;');
  });

  it('preserves state blocks before @media breakpoint blocks at the bottom of the file', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        stateOverrides: { hover: { backgroundColor: '#aaaaaa' } },
        breakpointOverrides: {
          tablet: { padding: [12, 12, 12, 12] },
        },
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
    });
    const hoverIdx = css.indexOf(':hover');
    const mediaIdx = css.indexOf('@media');
    expect(hoverIdx).toBeGreaterThan(-1);
    expect(mediaIdx).toBeGreaterThan(hoverIdx);
  });
});
