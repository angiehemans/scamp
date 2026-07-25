import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@store/canvasSlice';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';

/**
 * `deleteElementContents` empties an element in place: it recursively
 * removes every descendant and clears the element's own raw text and
 * inline "Raw" fragments, but keeps the element itself. This is the
 * right-click "Delete contents" action — the fix for agent-authored
 * raw text fragments that clutter a container.
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

const seed = (elements: Record<string, ScampElement>): void => {
  useCanvasStore.setState({
    elements,
    rootElementId: ROOT_ELEMENT_ID,
    selectedElementIds: [],
    editingElementId: null,
  });
};

describe('deleteElementContents', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      elements: { [ROOT_ELEMENT_ID]: makePageRoot([]) },
      rootElementId: ROOT_ELEMENT_ID,
      selectedElementIds: [],
      editingElementId: null,
    });
  });

  it('removes all children of the target and empties its childIds, keeping the target', () => {
    seed({
      [ROOT_ELEMENT_ID]: makePageRoot(['card_a1b2']),
      card_a1b2: makeRect({
        id: 'card_a1b2',
        parentId: ROOT_ELEMENT_ID,
        childIds: ['title_c3d4', 'body_e5f6'],
      }),
      title_c3d4: makeText({ id: 'title_c3d4', parentId: 'card_a1b2' }),
      body_e5f6: makeText({ id: 'body_e5f6', parentId: 'card_a1b2' }),
    });

    useCanvasStore.getState().deleteElementContents('card_a1b2');

    const state = useCanvasStore.getState();
    expect(state.elements['card_a1b2']).toBeDefined();
    expect(state.elements['card_a1b2']?.childIds).toEqual([]);
    expect(state.elements['title_c3d4']).toBeUndefined();
    expect(state.elements['body_e5f6']).toBeUndefined();
  });

  it('recursively removes grandchildren, not just direct children', () => {
    seed({
      [ROOT_ELEMENT_ID]: makePageRoot(['outer_a1b2']),
      outer_a1b2: makeRect({
        id: 'outer_a1b2',
        parentId: ROOT_ELEMENT_ID,
        childIds: ['inner_c3d4'],
      }),
      inner_c3d4: makeRect({
        id: 'inner_c3d4',
        parentId: 'outer_a1b2',
        childIds: ['leaf_e5f6'],
      }),
      leaf_e5f6: makeText({ id: 'leaf_e5f6', parentId: 'inner_c3d4' }),
    });

    useCanvasStore.getState().deleteElementContents('outer_a1b2');

    const state = useCanvasStore.getState();
    expect(state.elements['outer_a1b2']?.childIds).toEqual([]);
    expect(state.elements['inner_c3d4']).toBeUndefined();
    expect(state.elements['leaf_e5f6']).toBeUndefined();
  });

  it('leaves siblings and unrelated elements untouched', () => {
    seed({
      [ROOT_ELEMENT_ID]: makePageRoot(['card_a1b2', 'sibling_9999']),
      card_a1b2: makeRect({
        id: 'card_a1b2',
        parentId: ROOT_ELEMENT_ID,
        childIds: ['title_c3d4'],
      }),
      title_c3d4: makeText({ id: 'title_c3d4', parentId: 'card_a1b2' }),
      sibling_9999: makeRect({ id: 'sibling_9999', parentId: ROOT_ELEMENT_ID }),
    });

    useCanvasStore.getState().deleteElementContents('card_a1b2');

    const state = useCanvasStore.getState();
    expect(state.elements['sibling_9999']).toBeDefined();
    expect(state.elements[ROOT_ELEMENT_ID]?.childIds).toEqual([
      'card_a1b2',
      'sibling_9999',
    ]);
  });

  it('clears the loose inline "Raw" fragments on the target', () => {
    seed({
      [ROOT_ELEMENT_ID]: makePageRoot(['meta_a1b2']),
      meta_a1b2: makeRect({
        id: 'meta_a1b2',
        parentId: ROOT_ELEMENT_ID,
        inlineFragments: [
          { kind: 'text', value: 'Role: ', afterChildIndex: -1 },
          { kind: 'jsx', source: '<strong>Founder</strong>', afterChildIndex: -1 },
        ],
      }),
    });

    useCanvasStore.getState().deleteElementContents('meta_a1b2');

    expect(useCanvasStore.getState().elements['meta_a1b2']?.inlineFragments).toEqual(
      []
    );
  });

  it('clears the text of a text element', () => {
    seed({
      [ROOT_ELEMENT_ID]: makePageRoot(['heading_a1b2']),
      heading_a1b2: makeText({
        id: 'heading_a1b2',
        parentId: ROOT_ELEMENT_ID,
        text: 'Welcome to Scamp',
      }),
    });

    useCanvasStore.getState().deleteElementContents('heading_a1b2');

    const el = useCanvasStore.getState().elements['heading_a1b2'];
    expect(el).toBeDefined();
    expect(el?.text).toBe('');
  });

  it('prunes removed descendants from the selection but keeps the target selected', () => {
    seed({
      [ROOT_ELEMENT_ID]: makePageRoot(['card_a1b2']),
      card_a1b2: makeRect({
        id: 'card_a1b2',
        parentId: ROOT_ELEMENT_ID,
        childIds: ['title_c3d4'],
      }),
      title_c3d4: makeText({ id: 'title_c3d4', parentId: 'card_a1b2' }),
    });
    useCanvasStore.setState({ selectedElementIds: ['card_a1b2', 'title_c3d4'] });

    useCanvasStore.getState().deleteElementContents('card_a1b2');

    expect(useCanvasStore.getState().selectedElementIds).toEqual(['card_a1b2']);
  });

  it('clears editingElementId when the element being edited is removed', () => {
    seed({
      [ROOT_ELEMENT_ID]: makePageRoot(['card_a1b2']),
      card_a1b2: makeRect({
        id: 'card_a1b2',
        parentId: ROOT_ELEMENT_ID,
        childIds: ['title_c3d4'],
      }),
      title_c3d4: makeText({ id: 'title_c3d4', parentId: 'card_a1b2' }),
    });
    useCanvasStore.setState({ editingElementId: 'title_c3d4' });

    useCanvasStore.getState().deleteElementContents('card_a1b2');

    expect(useCanvasStore.getState().editingElementId).toBeNull();
  });

  it('empties the page root without removing it', () => {
    seed({
      [ROOT_ELEMENT_ID]: makePageRoot(['card_a1b2', 'sibling_9999']),
      card_a1b2: makeRect({ id: 'card_a1b2', parentId: ROOT_ELEMENT_ID }),
      sibling_9999: makeRect({ id: 'sibling_9999', parentId: ROOT_ELEMENT_ID }),
    });

    useCanvasStore.getState().deleteElementContents(ROOT_ELEMENT_ID);

    const state = useCanvasStore.getState();
    expect(state.elements[ROOT_ELEMENT_ID]).toBeDefined();
    expect(state.elements[ROOT_ELEMENT_ID]?.childIds).toEqual([]);
    expect(state.elements['card_a1b2']).toBeUndefined();
    expect(state.elements['sibling_9999']).toBeUndefined();
  });

  it('is a no-op on an already-empty element (no children, fragments, or text)', () => {
    seed({
      [ROOT_ELEMENT_ID]: makePageRoot(['empty_a1b2']),
      empty_a1b2: makeRect({ id: 'empty_a1b2', parentId: ROOT_ELEMENT_ID }),
    });
    const before = useCanvasStore.getState().elements;

    useCanvasStore.getState().deleteElementContents('empty_a1b2');

    // Same elements reference — the set() returned state unchanged.
    expect(useCanvasStore.getState().elements).toBe(before);
  });

  it('is a no-op on a missing element id', () => {
    seed({
      [ROOT_ELEMENT_ID]: makePageRoot(['card_a1b2']),
      card_a1b2: makeRect({ id: 'card_a1b2', parentId: ROOT_ELEMENT_ID }),
    });
    const before = useCanvasStore.getState().elements;

    useCanvasStore.getState().deleteElementContents('does_not_exist');

    expect(useCanvasStore.getState().elements).toBe(before);
  });
});
