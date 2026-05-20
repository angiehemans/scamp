import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@store/canvasSlice';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';

/**
 * Phase 8 coverage: `detachInstance` replaces a component-
 * instance on the page with a deep clone of the component's
 * tree (fresh ids, propOverrides baked in as literal text).
 */

const makePageRoot = (childIds: string[] = []): ScampElement => ({
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

const makeText = (
  overrides: Partial<ScampElement> & { id: string }
): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  type: 'text',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  text: 'hello',
  ...overrides,
});

const makeInstance = (
  overrides: Partial<ScampElement> & { id: string; componentName: string }
): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  type: 'component-instance',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  widthMode: 'auto',
  heightMode: 'auto',
  x: 0,
  y: 0,
  customProperties: {},
  instanceId: `inst_${overrides.id}`,
  propOverrides: {},
  ...overrides,
});

const seed = (
  elements: Record<string, ScampElement>,
  componentTrees: Parameters<typeof useCanvasStore.setState>[0] extends infer S
    ? S extends { componentTrees: infer C }
      ? C
      : never
    : never = {} as Record<string, never>
): void => {
  useCanvasStore.setState({
    elements,
    rootElementId: ROOT_ELEMENT_ID,
    selectedElementIds: [],
    componentTrees: componentTrees as Record<
      string,
      { elements: Record<string, ScampElement>; rootId: string }
    >,
  });
};

describe('detachInstance', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      elements: { [ROOT_ELEMENT_ID]: makePageRoot([]) },
      rootElementId: ROOT_ELEMENT_ID,
      selectedElementIds: [],
      componentTrees: {},
    });
  });

  it('returns null on a non-instance element id', () => {
    seed({
      [ROOT_ELEMENT_ID]: makePageRoot(['r1']),
      r1: makeRect({ id: 'r1' }),
    });
    const result = useCanvasStore.getState().detachInstance('r1');
    expect(result).toBeNull();
  });

  it('returns null when the component tree is not loaded', () => {
    seed({
      [ROOT_ELEMENT_ID]: makePageRoot(['i1']),
      i1: makeInstance({ id: 'i1', componentName: 'Button' }),
    });
    const result = useCanvasStore.getState().detachInstance('i1');
    expect(result).toBeNull();
    expect(useCanvasStore.getState().elements['i1']).toBeDefined();
  });

  it('replaces a single-root component with one cloned element', () => {
    const rootClone = makeRect({
      id: ROOT_ELEMENT_ID,
      parentId: null,
      backgroundColor: '#abcdef',
    });
    seed(
      {
        [ROOT_ELEMENT_ID]: makePageRoot(['i1']),
        i1: makeInstance({
          id: 'i1',
          componentName: 'Button',
          x: 100,
          y: 200,
        }),
      },
      {
        Button: {
          elements: { [ROOT_ELEMENT_ID]: rootClone },
          rootId: ROOT_ELEMENT_ID,
        },
      }
    );
    const newId = useCanvasStore.getState().detachInstance('i1');
    expect(newId).not.toBeNull();
    const state = useCanvasStore.getState();
    expect(state.elements['i1']).toBeUndefined();
    const cloned = state.elements[newId!];
    expect(cloned).toBeDefined();
    // Style copied from the component root.
    expect(cloned!.backgroundColor).toBe('#abcdef');
    // Position inherited from the instance, not the component root.
    expect(cloned!.x).toBe(100);
    expect(cloned!.y).toBe(200);
    // Parented to the page root (not null — the cloned root is
    // re-parented onto whatever the instance's parent was).
    expect(cloned!.parentId).toBe(ROOT_ELEMENT_ID);
    expect(state.elements[ROOT_ELEMENT_ID]!.childIds).toEqual([newId]);
  });

  it('clones nested children with fresh ids and depth preserved', () => {
    seed(
      {
        [ROOT_ELEMENT_ID]: makePageRoot(['i1']),
        i1: makeInstance({ id: 'i1', componentName: 'Card' }),
      },
      {
        Card: {
          elements: {
            [ROOT_ELEMENT_ID]: makeRect({
              id: ROOT_ELEMENT_ID,
              parentId: null,
              childIds: ['inner'],
            }),
            inner: makeRect({
              id: 'inner',
              parentId: ROOT_ELEMENT_ID,
              childIds: ['leaf'],
            }),
            leaf: makeText({ id: 'leaf', parentId: 'inner', text: 'hi' }),
          },
          rootId: ROOT_ELEMENT_ID,
        },
      }
    );
    const newId = useCanvasStore.getState().detachInstance('i1');
    const state = useCanvasStore.getState();
    // None of the original component-tree ids leaked into the
    // page (they could collide with future inserts).
    expect(state.elements['inner']).toBeUndefined();
    expect(state.elements['leaf']).toBeUndefined();
    // The clone-root has one child; that child has one child.
    const clonedRoot = state.elements[newId!]!;
    expect(clonedRoot.childIds.length).toBe(1);
    const middleId = clonedRoot.childIds[0]!;
    const middle = state.elements[middleId]!;
    expect(middle.parentId).toBe(newId);
    expect(middle.childIds.length).toBe(1);
    const leafId = middle.childIds[0]!;
    const leaf = state.elements[leafId]!;
    expect(leaf.parentId).toBe(middleId);
    expect(leaf.text).toBe('hi');
  });

  it('bakes a propOverride into the cloned text and drops the prop field', () => {
    seed(
      {
        [ROOT_ELEMENT_ID]: makePageRoot(['i1']),
        i1: makeInstance({
          id: 'i1',
          componentName: 'Button',
          propOverrides: { label: 'Save changes' },
        }),
      },
      {
        Button: {
          elements: {
            [ROOT_ELEMENT_ID]: makeRect({
              id: ROOT_ELEMENT_ID,
              parentId: null,
              childIds: ['t1'],
            }),
            t1: makeText({
              id: 't1',
              parentId: ROOT_ELEMENT_ID,
              text: 'Click me',
              prop: 'label',
            }),
          },
          rootId: ROOT_ELEMENT_ID,
        },
      }
    );
    const newId = useCanvasStore.getState().detachInstance('i1');
    const state = useCanvasStore.getState();
    const clonedRoot = state.elements[newId!]!;
    const clonedTextId = clonedRoot.childIds[0]!;
    const clonedText = state.elements[clonedTextId]!;
    expect(clonedText.text).toBe('Save changes');
    expect(clonedText.prop).toBeUndefined();
  });

  it('uses the component default when no override is set', () => {
    seed(
      {
        [ROOT_ELEMENT_ID]: makePageRoot(['i1']),
        i1: makeInstance({ id: 'i1', componentName: 'Button' }),
      },
      {
        Button: {
          elements: {
            [ROOT_ELEMENT_ID]: makeRect({
              id: ROOT_ELEMENT_ID,
              parentId: null,
              childIds: ['t1'],
            }),
            t1: makeText({
              id: 't1',
              parentId: ROOT_ELEMENT_ID,
              text: 'Click me',
              prop: 'label',
            }),
          },
          rootId: ROOT_ELEMENT_ID,
        },
      }
    );
    const newId = useCanvasStore.getState().detachInstance('i1');
    const state = useCanvasStore.getState();
    const clonedRoot = state.elements[newId!]!;
    const clonedText = state.elements[clonedRoot.childIds[0]!]!;
    expect(clonedText.text).toBe('Click me');
    expect(clonedText.prop).toBeUndefined();
  });

  it('preserves sibling order in the parent', () => {
    seed(
      {
        [ROOT_ELEMENT_ID]: makePageRoot(['a', 'i1', 'b']),
        a: makeRect({ id: 'a' }),
        i1: makeInstance({ id: 'i1', componentName: 'Button' }),
        b: makeRect({ id: 'b' }),
      },
      {
        Button: {
          elements: {
            [ROOT_ELEMENT_ID]: makeRect({
              id: ROOT_ELEMENT_ID,
              parentId: null,
            }),
          },
          rootId: ROOT_ELEMENT_ID,
        },
      }
    );
    const newId = useCanvasStore.getState().detachInstance('i1');
    const childIds = useCanvasStore.getState().elements[ROOT_ELEMENT_ID]!.childIds;
    expect(childIds).toEqual(['a', newId, 'b']);
  });

  it('selects the cloned root after detach', () => {
    seed(
      {
        [ROOT_ELEMENT_ID]: makePageRoot(['i1']),
        i1: makeInstance({ id: 'i1', componentName: 'Button' }),
      },
      {
        Button: {
          elements: {
            [ROOT_ELEMENT_ID]: makeRect({
              id: ROOT_ELEMENT_ID,
              parentId: null,
            }),
          },
          rootId: ROOT_ELEMENT_ID,
        },
      }
    );
    const newId = useCanvasStore.getState().detachInstance('i1');
    expect(useCanvasStore.getState().selectedElementIds).toEqual([newId]);
  });
});
