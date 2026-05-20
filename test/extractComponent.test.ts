import { describe, it, expect } from 'vitest';
import {
  extractSubtreeAsComponent,
  generateComponentFromSubtree,
} from '@lib/extractComponent';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';

const makeRoot = (childIds: string[]): ScampElement => ({
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
  backgroundColor: '#ffffff',
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

describe('extractSubtreeAsComponent', () => {
  it('returns null when the subtree root is missing from the map', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot([]),
    };
    expect(extractSubtreeAsComponent(elements, 'does-not-exist')).toBeNull();
  });

  it('rerooted subtree root has id = ROOT_ELEMENT_ID and parentId = null', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        x: 50,
        y: 60,
        backgroundColor: '#ff0000',
      }),
    };
    const result = extractSubtreeAsComponent(elements, 'a1b2');
    expect(result).not.toBeNull();
    expect(result!.rootId).toBe(ROOT_ELEMENT_ID);
    const newRoot = result!.elements[ROOT_ELEMENT_ID];
    expect(newRoot).toBeDefined();
    expect(newRoot!.id).toBe(ROOT_ELEMENT_ID);
    expect(newRoot!.parentId).toBeNull();
    // Style fields preserved.
    expect(newRoot!.x).toBe(50);
    expect(newRoot!.y).toBe(60);
    expect(newRoot!.backgroundColor).toBe('#ff0000');
  });

  it('keeps every descendant in the extracted map', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', childIds: ['c3d4'] }),
      c3d4: makeRect({
        id: 'c3d4',
        parentId: 'a1b2',
        childIds: ['e5f6'],
      }),
      e5f6: makeRect({ id: 'e5f6', parentId: 'c3d4' }),
    };
    const result = extractSubtreeAsComponent(elements, 'a1b2');
    expect(result).not.toBeNull();
    expect(Object.keys(result!.elements).sort()).toEqual(
      [ROOT_ELEMENT_ID, 'c3d4', 'e5f6'].sort()
    );
  });

  it('remaps direct children parentId from the source subtree root to ROOT_ELEMENT_ID', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', childIds: ['c3d4', 'e5f6'] }),
      c3d4: makeRect({ id: 'c3d4', parentId: 'a1b2' }),
      e5f6: makeRect({ id: 'e5f6', parentId: 'a1b2' }),
    };
    const result = extractSubtreeAsComponent(elements, 'a1b2');
    expect(result!.elements['c3d4']!.parentId).toBe(ROOT_ELEMENT_ID);
    expect(result!.elements['e5f6']!.parentId).toBe(ROOT_ELEMENT_ID);
  });

  it('preserves deeper parent-child links unchanged', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', childIds: ['c3d4'] }),
      c3d4: makeRect({
        id: 'c3d4',
        parentId: 'a1b2',
        childIds: ['e5f6'],
      }),
      e5f6: makeRect({ id: 'e5f6', parentId: 'c3d4' }),
    };
    const result = extractSubtreeAsComponent(elements, 'a1b2');
    // e5f6's parent is still c3d4 — only the top-level edge gets
    // remapped, deeper edges stay verbatim.
    expect(result!.elements['e5f6']!.parentId).toBe('c3d4');
  });

  it('drops the source root\'s name field (component identity is the file name)', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', name: 'hero-card' }),
    };
    const result = extractSubtreeAsComponent(elements, 'a1b2');
    expect(result!.elements[ROOT_ELEMENT_ID]!.name).toBeUndefined();
  });

  it('does NOT include sibling elements that share a parent with the subtree root', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2', 'g7h8']),
      a1b2: makeRect({ id: 'a1b2' }),
      g7h8: makeRect({ id: 'g7h8' }),
    };
    const result = extractSubtreeAsComponent(elements, 'a1b2');
    expect(result!.elements['g7h8']).toBeUndefined();
  });
});

describe('generateComponentFromSubtree', () => {
  it('emits the component name as the TSX function name + the import basename', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2' }),
    };
    const result = generateComponentFromSubtree(elements, 'a1b2', 'Button');
    expect(result).not.toBeNull();
    expect(result!.tsx).toContain(
      "import styles from './Button.module.css';"
    );
    expect(result!.tsx).toContain('export default function Button()');
  });

  it('emits the subtree root as <div data-scamp-id="root">', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', backgroundColor: '#ff0000' }),
    };
    const result = generateComponentFromSubtree(elements, 'a1b2', 'Button');
    expect(result!.tsx).toContain('data-scamp-id="root"');
    expect(result!.css).toContain('.root');
  });

  it('returns null when the subtree root is missing', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot([]),
    };
    expect(
      generateComponentFromSubtree(elements, 'a1b2', 'Button')
    ).toBeNull();
  });

  it('captures descendants in the generated TSX', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', childIds: ['c3d4'] }),
      c3d4: makeRect({
        id: 'c3d4',
        parentId: 'a1b2',
        backgroundColor: '#00ff00',
      }),
    };
    const result = generateComponentFromSubtree(elements, 'a1b2', 'Card');
    expect(result!.tsx).toContain('data-scamp-id="rect_c3d4"');
    expect(result!.css).toContain('rect_c3d4');
    expect(result!.css).toContain('#00ff00');
  });
});
