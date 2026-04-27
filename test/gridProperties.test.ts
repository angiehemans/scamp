import { describe, it, expect } from 'vitest';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';
import { DEFAULT_BREAKPOINTS } from '@shared/types';

const makeRoot = (childIds: string[] = []): ScampElement => ({
  id: ROOT_ELEMENT_ID,
  type: 'rectangle',
  parentId: null,
  childIds,
  widthMode: 'stretch',
  widthValue: 1440,
  heightMode: 'auto',
  heightValue: 900,
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
  transitions: [],
  customProperties: {},
});

const makeRect = (
  id: string,
  parentId: string,
  overrides: Partial<ScampElement> = {}
): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id,
  type: 'rectangle',
  parentId,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  ...overrides,
});

describe('grid: generator (container)', () => {
  it('omits grid declarations when display is not grid', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect('a1b2', ROOT_ELEMENT_ID, {
        gridTemplateColumns: '1fr 1fr',
        columnGap: 16,
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    expect(css).not.toContain('grid-template-columns');
    expect(css).not.toContain('column-gap');
    expect(css).not.toContain('display: grid');
  });

  it('emits display: grid + non-empty grid fields when display is grid', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect('a1b2', ROOT_ELEMENT_ID, {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: 'auto',
        columnGap: 16,
        rowGap: 8,
        justifyItems: 'center',
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    expect(css).toContain('display: grid;');
    expect(css).toContain('grid-template-columns: 1fr 1fr;');
    expect(css).toContain('grid-template-rows: auto;');
    expect(css).toContain('column-gap: 16px;');
    expect(css).toContain('row-gap: 8px;');
    expect(css).toContain('justify-items: center;');
  });

  it('does not emit grid-only fields whose values still match defaults', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect('a1b2', ROOT_ELEMENT_ID, { display: 'grid' }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    expect(css).toContain('display: grid;');
    expect(css).not.toContain('grid-template-columns');
    expect(css).not.toContain('column-gap');
    expect(css).not.toContain('justify-items');
  });

  it('does not emit flex-only fields when display is grid', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect('a1b2', ROOT_ELEMENT_ID, {
        display: 'grid',
        flexDirection: 'column',
        gap: 16,
        justifyContent: 'center',
        gridTemplateColumns: '1fr 1fr',
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    expect(css).toContain('display: grid;');
    expect(css).not.toContain('flex-direction');
    expect(css).not.toMatch(/\bgap:/);
    expect(css).not.toContain('justify-content');
  });
});

describe('grid: generator (item)', () => {
  it('emits grid-column / grid-row when parent is grid', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['p1']),
      p1: makeRect('p1', ROOT_ELEMENT_ID, {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
      }),
      c1: makeRect('c1', 'p1', {
        gridColumn: 'span 2',
        gridRow: '1 / 3',
        alignSelf: 'center',
        justifySelf: 'end',
      }),
    };
    elements.p1.childIds = ['c1'];

    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    expect(css).toContain('grid-column: span 2;');
    expect(css).toContain('grid-row: 1 / 3;');
    expect(css).toContain('align-self: center;');
    expect(css).toContain('justify-self: end;');
  });

  it('does not emit grid-item fields when parent is not grid', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['p1']),
      p1: makeRect('p1', ROOT_ELEMENT_ID, { display: 'flex' }),
      c1: makeRect('c1', 'p1', {
        gridColumn: 'span 2',
        alignSelf: 'center',
      }),
    };
    elements.p1.childIds = ['c1'];

    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    expect(css).not.toContain('grid-column');
    expect(css).not.toContain('align-self');
  });

  it('omits position: absolute / left / top for grid children', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['p1']),
      p1: makeRect('p1', ROOT_ELEMENT_ID, {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
      }),
      c1: makeRect('c1', 'p1', { x: 50, y: 50 }),
    };
    elements.p1.childIds = ['c1'];

    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    // The c1 block exists.
    expect(css).toMatch(/\.rect_c1\s*\{/);
    // But it does not carry position / left / top.
    const block = css.match(/\.rect_c1\s*\{[^}]*\}/)?.[0] ?? '';
    expect(block).not.toContain('position');
    expect(block).not.toContain('left:');
    expect(block).not.toContain('top:');
  });
});

describe('grid: round-trip', () => {
  it('round-trips display:grid + container + item declarations', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['p1']),
      p1: makeRect('p1', ROOT_ELEMENT_ID, {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'auto auto',
        columnGap: 16,
        rowGap: 8,
        justifyItems: 'center',
      }),
      c1: makeRect('c1', 'p1', {
        gridColumn: 'span 2',
        alignSelf: 'end',
      }),
    };
    elements.p1.childIds = ['c1'];

    const code = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    const parsed = parseCode(code.tsx, code.css, {
      breakpoints: DEFAULT_BREAKPOINTS,
    });

    const parent = parsed.elements['p1'];
    const child = parsed.elements['c1'];
    expect(parent?.display).toBe('grid');
    expect(parent?.gridTemplateColumns).toBe('repeat(3, 1fr)');
    expect(parent?.gridTemplateRows).toBe('auto auto');
    expect(parent?.columnGap).toBe(16);
    expect(parent?.rowGap).toBe(8);
    expect(parent?.justifyItems).toBe('center');
    expect(child?.gridColumn).toBe('span 2');
    expect(child?.alignSelf).toBe('end');
  });
});
