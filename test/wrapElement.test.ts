import { describe, it, expect } from 'vitest';
import {
  wrapElement,
  ungroupSiblings,
  ROOT_ELEMENT_ID,
  type ScampElement,
} from '@lib/element';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';

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

const makeRoot = (childIds: string[] = []): ScampElement => ({
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
  boxShadows: [],
  transitions: [],
  inlineFragments: [],
  customProperties: {},
});

describe('wrapElement', () => {
  it('wraps a non-root element under a fresh <a> parent with the supplied attributes', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', x: 100, y: 200 }),
    };
    const result = wrapElement(elements, 'a1b2', 'w001', {
      tag: 'a',
      attributes: { href: '/dashboard' },
      customProperties: { display: 'block' },
    });
    expect(result).not.toBeNull();
    const next = result!.elements;

    // Root now has the wrapper as its child, in place of a1b2.
    expect(next[ROOT_ELEMENT_ID]?.childIds).toEqual(['w001']);
    // Wrapper has the right tag, attributes, and customProperties.
    expect(next['w001']?.tag).toBe('a');
    expect(next['w001']?.attributes).toEqual({ href: '/dashboard' });
    expect(next['w001']?.customProperties).toEqual({ display: 'block' });
    // Wrapper inherits the wrapped element's position so it sits where
    // the child sat.
    expect(next['w001']?.x).toBe(100);
    expect(next['w001']?.y).toBe(200);
    expect(next['w001']?.parentId).toBe(ROOT_ELEMENT_ID);
    expect(next['w001']?.childIds).toEqual(['a1b2']);
    // Wrapped child reparented onto the wrapper at origin.
    expect(next['a1b2']?.parentId).toBe('w001');
    expect(next['a1b2']?.x).toBe(0);
    expect(next['a1b2']?.y).toBe(0);
  });

  it('refuses to wrap the root element', () => {
    const elements = { [ROOT_ELEMENT_ID]: makeRoot() };
    expect(
      wrapElement(elements, ROOT_ELEMENT_ID, 'w001', { tag: 'a' })
    ).toBeNull();
  });

  it('refuses to wrap a non-existent element', () => {
    const elements = { [ROOT_ELEMENT_ID]: makeRoot() };
    expect(wrapElement(elements, 'ghost', 'w001', { tag: 'a' })).toBeNull();
  });

  it('places the wrapper at index 0,0 inside a flex parent (parent owns layout)', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['flex01']),
      flex01: makeRect({
        id: 'flex01',
        display: 'flex',
        childIds: ['a1b2', 'c3d4'],
      }),
      a1b2: makeRect({ id: 'a1b2', parentId: 'flex01', x: 100, y: 200 }),
      c3d4: makeRect({ id: 'c3d4', parentId: 'flex01', x: 50, y: 50 }),
    };
    const result = wrapElement(elements, 'a1b2', 'w001', {
      tag: 'a',
      attributes: { href: '/about' },
    });
    expect(result).not.toBeNull();
    const next = result!.elements;
    expect(next['w001']?.x).toBe(0);
    expect(next['w001']?.y).toBe(0);
    // Wrapper takes the slot where a1b2 used to be.
    expect(next['flex01']?.childIds).toEqual(['w001', 'c3d4']);
  });

  it('preserves sibling order when wrapping a middle child', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['x001', 'a1b2', 'y001']),
      x001: makeRect({ id: 'x001' }),
      a1b2: makeRect({ id: 'a1b2' }),
      y001: makeRect({ id: 'y001' }),
    };
    const result = wrapElement(elements, 'a1b2', 'w001', {
      tag: 'a',
      attributes: { href: '/' },
    });
    expect(result!.elements[ROOT_ELEMENT_ID]?.childIds).toEqual([
      'x001',
      'w001',
      'y001',
    ]);
  });

  it('round-trips through generateCode → parseCode unchanged', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', x: 50, y: 60 }),
    };
    const wrapped = wrapElement(elements, 'a1b2', 'w001', {
      tag: 'a',
      attributes: { href: '/dashboard' },
      customProperties: { display: 'block' },
    });
    expect(wrapped).not.toBeNull();
    const { tsx, css } = generateCode({
      elements: wrapped!.elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    const parsed = parseCode(tsx, css);
    // Tree shape preserved.
    expect(parsed.elements[ROOT_ELEMENT_ID]?.childIds).toEqual(['w001']);
    expect(parsed.elements['w001']?.tag).toBe('a');
    expect(parsed.elements['w001']?.attributes).toEqual({ href: '/dashboard' });
    expect(parsed.elements['w001']?.childIds).toEqual(['a1b2']);
    expect(parsed.elements['a1b2']?.parentId).toBe('w001');
  });

  it('inverse via ungroupSiblings restores the original parent/child relation', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', x: 100, y: 200 }),
    };
    const wrapped = wrapElement(elements, 'a1b2', 'w001', {
      tag: 'a',
      attributes: { href: '/dashboard' },
    });
    expect(wrapped).not.toBeNull();
    const unwrapped = ungroupSiblings(wrapped!.elements, 'w001');
    expect(unwrapped).not.toBeNull();
    // a1b2 is back as a direct child of root.
    expect(unwrapped!.elements[ROOT_ELEMENT_ID]?.childIds).toEqual(['a1b2']);
    expect(unwrapped!.elements['a1b2']?.parentId).toBe(ROOT_ELEMENT_ID);
    // Wrapper element removed.
    expect(unwrapped!.elements['w001']).toBeUndefined();
  });
});
