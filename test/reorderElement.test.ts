import { describe, it, expect } from 'vitest';
import { reorderElementPure, ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';
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

describe('reorderElementPure', () => {
  it('moves a sibling forward in its parent', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a', 'b', 'c', 'd']),
      a: makeRect({ id: 'a' }),
      b: makeRect({ id: 'b' }),
      c: makeRect({ id: 'c' }),
      d: makeRect({ id: 'd' }),
    };
    // Move 'a' so it ends up at index 2 (after 'c').
    const next = reorderElementPure(elements, 'a', ROOT_ELEMENT_ID, 3)!;
    expect(next[ROOT_ELEMENT_ID]!.childIds).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves a sibling backward in its parent', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a', 'b', 'c', 'd']),
      a: makeRect({ id: 'a' }),
      b: makeRect({ id: 'b' }),
      c: makeRect({ id: 'c' }),
      d: makeRect({ id: 'd' }),
    };
    // Move 'd' so it ends up at index 1 (before 'b').
    const next = reorderElementPure(elements, 'd', ROOT_ELEMENT_ID, 1)!;
    expect(next[ROOT_ELEMENT_ID]!.childIds).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns the unchanged map when the destination is the current slot', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a', 'b']),
      a: makeRect({ id: 'a' }),
      b: makeRect({ id: 'b' }),
    };
    const next = reorderElementPure(elements, 'a', ROOT_ELEMENT_ID, 0)!;
    expect(next[ROOT_ELEMENT_ID]!.childIds).toEqual(['a', 'b']);
  });

  it('reparents an element to a new parent and updates parentId', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a', 'b']),
      a: makeRect({ id: 'a' }),
      b: makeRect({ id: 'b', childIds: [] }),
    };
    const next = reorderElementPure(elements, 'a', 'b', 0)!;
    expect(next[ROOT_ELEMENT_ID]!.childIds).toEqual(['b']);
    expect(next['b']!.childIds).toEqual(['a']);
    expect(next['a']!.parentId).toBe('b');
  });

  it('refuses to move an element into itself', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a']),
      a: makeRect({ id: 'a' }),
    };
    expect(reorderElementPure(elements, 'a', 'a', 0)).toBeNull();
  });

  it('refuses to move an element into one of its own descendants', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a']),
      a: makeRect({ id: 'a', childIds: ['b'] }),
      b: makeRect({ id: 'b', parentId: 'a', childIds: ['c'] }),
      c: makeRect({ id: 'c', parentId: 'b' }),
    };
    expect(reorderElementPure(elements, 'a', 'c', 0)).toBeNull();
  });

  it('refuses to move the root element', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a']),
      a: makeRect({ id: 'a' }),
    };
    expect(reorderElementPure(elements, ROOT_ELEMENT_ID, 'a', 0)).toBeNull();
  });

  it('clamps newIndex to the destination childIds length', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a', 'b', 'c']),
      a: makeRect({ id: 'a' }),
      b: makeRect({ id: 'b' }),
      c: makeRect({ id: 'c' }),
    };
    // Asking for index 99 in same parent → end of list.
    const next = reorderElementPure(elements, 'a', ROOT_ELEMENT_ID, 99)!;
    expect(next[ROOT_ELEMENT_ID]!.childIds).toEqual(['b', 'c', 'a']);
  });

  it('returns null when the source element does not exist', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(),
    };
    expect(reorderElementPure(elements, 'missing', ROOT_ELEMENT_ID, 0)).toBeNull();
  });

  it('returns null when the destination parent does not exist', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a']),
      a: makeRect({ id: 'a' }),
    };
    expect(reorderElementPure(elements, 'a', 'missing', 0)).toBeNull();
  });
});
