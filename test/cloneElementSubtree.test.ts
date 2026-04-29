import { describe, it, expect } from 'vitest';
import { cloneElementSubtree, ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';

const makeRect = (overrides: Partial<ScampElement> & { id: string }): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  type: 'rectangle',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  ...overrides,
});

const makeRoot = (childIds: string[] = []): ScampElement => ({
  id: ROOT_ELEMENT_ID,
  type: 'rectangle',
  parentId: null,
  childIds,
  widthMode: 'fixed',
  widthValue: 1440,
  heightMode: 'fixed',
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
  position: 'auto',
  transitions: [],
  inlineFragments: [],
  customProperties: {},
});

const seq = (ids: string[]): (() => string) => {
  let i = 0;
  return () => ids[i++] ?? `extra${i}`;
};

describe('cloneElementSubtree', () => {
  it('clones a single rect with a fresh id under the same parent', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        x: 100,
        y: 50,
        widthValue: 200,
        heightValue: 200,
        backgroundColor: '#3b82f6',
      }),
    };
    const result = cloneElementSubtree(
      elements,
      'a1b2',
      ROOT_ELEMENT_ID,
      new Set(['root', 'a1b2']),
      seq(['c0c0'])
    );
    expect(result).not.toBeNull();
    expect(result!.newId).toBe('c0c0');
    expect(result!.cloned).toEqual({
      c0c0: {
        ...elements['a1b2'],
        id: 'c0c0',
        parentId: ROOT_ELEMENT_ID,
        childIds: [],
      },
    });
  });

  it('clones a nested subtree with fresh ids for every descendant', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        widthValue: 400,
        heightValue: 400,
        childIds: ['c3d4', 'e5f6'],
      }),
      c3d4: makeRect({ id: 'c3d4', parentId: 'a1b2', x: 10, y: 10 }),
      e5f6: makeRect({ id: 'e5f6', parentId: 'a1b2', x: 200, y: 200 }),
    };
    const result = cloneElementSubtree(
      elements,
      'a1b2',
      ROOT_ELEMENT_ID,
      new Set(['root', 'a1b2', 'c3d4', 'e5f6']),
      seq(['n001', 'n002', 'n003'])
    );
    expect(result).not.toBeNull();
    const { newId, cloned } = result!;
    expect(newId).toBe('n001');
    expect(Object.keys(cloned).sort()).toEqual(['n001', 'n002', 'n003']);
    expect(cloned['n001']?.childIds).toEqual(['n002', 'n003']);
    expect(cloned['n002']?.parentId).toBe('n001');
    expect(cloned['n003']?.parentId).toBe('n001');
    expect(cloned['n002']?.x).toBe(10);
    expect(cloned['n003']?.x).toBe(200);
  });

  it('produces deep copies of customProperties and padding', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        padding: [4, 8, 12, 16],
        customProperties: { 'box-shadow': '0 1px 2px black' },
      }),
    };
    const result = cloneElementSubtree(
      elements,
      'a1b2',
      ROOT_ELEMENT_ID,
      new Set(['root', 'a1b2']),
      seq(['c0c0'])
    );
    const clone = result!.cloned['c0c0']!;
    // Mutating the clone must not affect the original.
    clone.padding[0] = 99;
    clone.customProperties['transform'] = 'rotate(2deg)';
    expect(elements['a1b2']!.padding[0]).toBe(4);
    expect(elements['a1b2']!.customProperties['transform']).toBeUndefined();
  });

  it('regenerates colliding ids', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2' }),
      taken: makeRect({ id: 'taken' }),
    };
    const result = cloneElementSubtree(
      elements,
      'a1b2',
      ROOT_ELEMENT_ID,
      new Set(['root', 'a1b2', 'taken', 'first']),
      seq(['first', 'second'])
    );
    expect(result!.newId).toBe('second');
  });

  it('returns null when the source element does not exist', () => {
    const result = cloneElementSubtree(
      { [ROOT_ELEMENT_ID]: makeRoot() },
      'missing',
      ROOT_ELEMENT_ID,
      new Set(['root']),
      seq(['x'])
    );
    expect(result).toBeNull();
  });
});
