import { describe, it, expect } from 'vitest';
import {
  groupSiblings,
  ungroupSiblings,
  ROOT_ELEMENT_ID,
  type ScampElement,
} from '@lib/element';
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
  padding: [0, 0, 0, 0],
  margin: [0, 0, 0, 0],
  backgroundColor: '#ffffff',
  borderRadius: 0,
  borderWidth: 0,
  borderStyle: 'none',
  borderColor: '#000000',
  customProperties: {},
});

describe('groupSiblings', () => {
  it('wraps two siblings in a new flex group at their bounding box', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2', 'c3d4']),
      a1b2: makeRect({ id: 'a1b2', x: 100, y: 50, widthValue: 200, heightValue: 200 }),
      c3d4: makeRect({ id: 'c3d4', x: 400, y: 200, widthValue: 100, heightValue: 100 }),
    };
    const result = groupSiblings(elements, ['a1b2', 'c3d4'], 'g0g0');
    expect(result).not.toBeNull();
    const next = result!.elements;
    const group = next['g0g0']!;
    expect(group.parentId).toBe(ROOT_ELEMENT_ID);
    expect(group.display).toBe('flex');
    expect(group.childIds).toEqual(['a1b2', 'c3d4']);
    // Bounding box: min(100, 400)=100, min(50, 200)=50, max(300, 500)=500, max(250, 300)=300
    expect(group.x).toBe(100);
    expect(group.y).toBe(50);
    expect(group.widthValue).toBe(400);
    expect(group.heightValue).toBe(250);
    // Groups default to fit-content on both axes so the wrapper hugs
    // its children visually.
    expect(group.widthMode).toBe('fit-content');
    expect(group.heightMode).toBe('fit-content');
    // Children re-parented and reset to 0,0
    expect(next['a1b2']!.parentId).toBe('g0g0');
    expect(next['a1b2']!.x).toBe(0);
    expect(next['a1b2']!.y).toBe(0);
    expect(next['c3d4']!.parentId).toBe('g0g0');
    // Root's childIds: just the group
    expect(next[ROOT_ELEMENT_ID]!.childIds).toEqual(['g0g0']);
  });

  it('preserves child order from the parent regardless of selection order', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a', 'b', 'c']),
      a: makeRect({ id: 'a', x: 0, y: 0 }),
      b: makeRect({ id: 'b', x: 0, y: 100 }),
      c: makeRect({ id: 'c', x: 0, y: 200 }),
    };
    // Select c then a — order in input shouldn't matter.
    const result = groupSiblings(elements, ['c', 'a'], 'g')!;
    expect(result.elements['g']!.childIds).toEqual(['a', 'c']);
    // 'b' is left in place between... actually 'b' wasn't selected so it
    // stays as a sibling of the new group.
    expect(result.elements[ROOT_ELEMENT_ID]!.childIds).toEqual(['g', 'b']);
  });

  it('inserts the group at the position of the first grouped sibling', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a', 'b', 'c', 'd']),
      a: makeRect({ id: 'a' }),
      b: makeRect({ id: 'b' }),
      c: makeRect({ id: 'c' }),
      d: makeRect({ id: 'd' }),
    };
    const result = groupSiblings(elements, ['b', 'c'], 'g')!;
    expect(result.elements[ROOT_ELEMENT_ID]!.childIds).toEqual(['a', 'g', 'd']);
    expect(result.elements['g']!.childIds).toEqual(['b', 'c']);
  });

  it('rejects mixed parents', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', childIds: ['c3d4'] }),
      c3d4: makeRect({ id: 'c3d4', parentId: 'a1b2' }),
      e5f6: makeRect({ id: 'e5f6' }),
    };
    elements[ROOT_ELEMENT_ID]!.childIds.push('e5f6');
    const result = groupSiblings(elements, ['c3d4', 'e5f6'], 'g');
    expect(result).toBeNull();
  });

  it('rejects an empty selection', () => {
    const elements: Record<string, ScampElement> = { [ROOT_ELEMENT_ID]: makeRoot() };
    expect(groupSiblings(elements, [], 'g')).toBeNull();
  });

  it('rejects grouping the root', () => {
    const elements: Record<string, ScampElement> = { [ROOT_ELEMENT_ID]: makeRoot() };
    expect(groupSiblings(elements, [ROOT_ELEMENT_ID], 'g')).toBeNull();
  });

  it('uses x/y of 0 when the parent is a flex container', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: { ...makeRoot(['a', 'b']), display: 'flex' },
      a: makeRect({ id: 'a', x: 0, y: 0, widthValue: 100, heightValue: 100 }),
      b: makeRect({ id: 'b', x: 0, y: 0, widthValue: 100, heightValue: 100 }),
    };
    const result = groupSiblings(elements, ['a', 'b'], 'g')!;
    const group = result.elements['g']!;
    expect(group.x).toBe(0);
    expect(group.y).toBe(0);
  });
});

describe('ungroupSiblings', () => {
  it('promotes children to the grandparent at the group position', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['g']),
      g: makeRect({
        id: 'g',
        display: 'flex',
        x: 100,
        y: 50,
        widthValue: 400,
        heightValue: 200,
        childIds: ['a', 'b'],
      }),
      a: makeRect({ id: 'a', parentId: 'g', x: 0, y: 0 }),
      b: makeRect({ id: 'b', parentId: 'g', x: 0, y: 0 }),
    };
    const result = ungroupSiblings(elements, 'g')!;
    expect(result.promotedIds).toEqual(['a', 'b']);
    expect(result.elements['g']).toBeUndefined();
    expect(result.elements[ROOT_ELEMENT_ID]!.childIds).toEqual(['a', 'b']);
    // Both children inherit the group's stored position because the group
    // was a flex container (children's x/y was 0).
    expect(result.elements['a']!.parentId).toBe(ROOT_ELEMENT_ID);
    expect(result.elements['a']!.x).toBe(100);
    expect(result.elements['a']!.y).toBe(50);
    expect(result.elements['b']!.x).toBe(100);
  });

  it('translates non-flex group children by the group offset', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['g']),
      g: makeRect({
        id: 'g',
        x: 100,
        y: 50,
        widthValue: 400,
        heightValue: 400,
        childIds: ['a'],
      }),
      a: makeRect({ id: 'a', parentId: 'g', x: 20, y: 30 }),
    };
    const result = ungroupSiblings(elements, 'g')!;
    expect(result.elements['a']!.x).toBe(120); // 100 + 20
    expect(result.elements['a']!.y).toBe(80); // 50 + 30
  });

  it('keeps siblings of the group in their original positions', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['x', 'g', 'y']),
      x: makeRect({ id: 'x' }),
      g: makeRect({
        id: 'g',
        display: 'flex',
        childIds: ['a', 'b'],
      }),
      y: makeRect({ id: 'y' }),
      a: makeRect({ id: 'a', parentId: 'g' }),
      b: makeRect({ id: 'b', parentId: 'g' }),
    };
    const result = ungroupSiblings(elements, 'g')!;
    expect(result.elements[ROOT_ELEMENT_ID]!.childIds).toEqual(['x', 'a', 'b', 'y']);
  });

  it('rejects ungrouping the root', () => {
    const elements: Record<string, ScampElement> = { [ROOT_ELEMENT_ID]: makeRoot(['a']) };
    elements['a'] = makeRect({ id: 'a' });
    expect(ungroupSiblings(elements, ROOT_ELEMENT_ID)).toBeNull();
  });

  it('rejects ungrouping a leaf with no children', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a']),
      a: makeRect({ id: 'a' }),
    };
    expect(ungroupSiblings(elements, 'a')).toBeNull();
  });
});
