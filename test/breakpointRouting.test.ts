import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@store/canvasSlice';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';

/**
 * End-to-end tests of the store's breakpoint-aware routing. Verifies
 * that `patchElement`, `moveElement`, and `resizeElement` send style
 * fields to `breakpointOverrides[active]` when the active breakpoint
 * isn't desktop, and keep identity/content fields on the top level.
 */

const rectId = 'a1b2';

const makeRect = (overrides: Partial<ScampElement> = {}): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id: rectId,
  type: 'rectangle',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  ...overrides,
});

const resetStore = (el: ScampElement, activeBreakpointId: string): void => {
  useCanvasStore.setState({
    elements: {
      [ROOT_ELEMENT_ID]: {
        ...DEFAULT_RECT_STYLES,
        id: ROOT_ELEMENT_ID,
        type: 'rectangle',
        parentId: null,
        childIds: [el.id],
        x: 0,
        y: 0,
        customProperties: {},
      },
      [el.id]: el,
    },
    activeBreakpointId,
  });
};

describe('patchElement routing', () => {
  beforeEach(() => {
    // Reset active breakpoint back to desktop so tests don't bleed.
    useCanvasStore.setState({ activeBreakpointId: 'desktop' });
  });

  it('patches base fields directly at desktop', () => {
    resetStore(makeRect({ padding: [0, 0, 0, 0] }), 'desktop');
    useCanvasStore
      .getState()
      .patchElement(rectId, { padding: [16, 16, 16, 16] });
    const el = useCanvasStore.getState().elements[rectId]!;
    expect(el.padding).toEqual([16, 16, 16, 16]);
    expect(el.breakpointOverrides).toBeUndefined();
  });

  it('routes style patches into breakpointOverrides[active] at tablet', () => {
    resetStore(makeRect({ padding: [0, 0, 0, 0] }), 'tablet');
    useCanvasStore
      .getState()
      .patchElement(rectId, { padding: [12, 12, 12, 12] });
    const el = useCanvasStore.getState().elements[rectId]!;
    // Base untouched.
    expect(el.padding).toEqual([0, 0, 0, 0]);
    // Override populated.
    expect(el.breakpointOverrides?.tablet).toEqual({ padding: [12, 12, 12, 12] });
  });

  it('merges into an existing breakpoint override without wiping other fields', () => {
    resetStore(
      makeRect({
        breakpointOverrides: {
          tablet: { padding: [12, 12, 12, 12] },
        },
      }),
      'tablet'
    );
    useCanvasStore
      .getState()
      .patchElement(rectId, { backgroundColor: '#ff0000' });
    const el = useCanvasStore.getState().elements[rectId]!;
    expect(el.breakpointOverrides?.tablet).toEqual({
      padding: [12, 12, 12, 12],
      backgroundColor: '#ff0000',
    });
  });

  it('splits a mixed patch — tag goes to base, padding goes to override', () => {
    resetStore(makeRect({ padding: [0, 0, 0, 0] }), 'mobile');
    useCanvasStore
      .getState()
      .patchElement(rectId, { tag: 'section', padding: [8, 8, 8, 8] });
    const el = useCanvasStore.getState().elements[rectId]!;
    // `tag` is identity-level — always writes to base regardless of breakpoint.
    expect(el.tag).toBe('section');
    expect(el.padding).toEqual([0, 0, 0, 0]);
    expect(el.breakpointOverrides?.mobile).toEqual({ padding: [8, 8, 8, 8] });
  });

  it('merges customProperties entries instead of replacing them', () => {
    resetStore(
      makeRect({
        breakpointOverrides: {
          tablet: { customProperties: { transform: 'rotate(5deg)' } },
        },
      }),
      'tablet'
    );
    useCanvasStore
      .getState()
      .patchElement(rectId, {
        customProperties: { 'box-shadow': '0 2px 4px black' },
      });
    const el = useCanvasStore.getState().elements[rectId]!;
    expect(el.breakpointOverrides?.tablet?.customProperties).toEqual({
      transform: 'rotate(5deg)',
      'box-shadow': '0 2px 4px black',
    });
  });
});

describe('moveElement / resizeElement routing', () => {
  it('moveElement writes x/y into the override at tablet', () => {
    resetStore(makeRect({ x: 10, y: 20 }), 'tablet');
    useCanvasStore.getState().moveElement(rectId, 40, 60);
    const el = useCanvasStore.getState().elements[rectId]!;
    // Base x/y untouched.
    expect(el.x).toBe(10);
    expect(el.y).toBe(20);
    expect(el.breakpointOverrides?.tablet).toEqual({ x: 40, y: 60 });
  });

  it('resizeElement writes size fields into the override at mobile', () => {
    resetStore(
      makeRect({
        x: 0,
        y: 0,
        widthMode: 'stretch',
        widthValue: 400,
        heightMode: 'auto',
        heightValue: 200,
      }),
      'mobile'
    );
    useCanvasStore.getState().resizeElement(rectId, 0, 0, 360, 180);
    const el = useCanvasStore.getState().elements[rectId]!;
    // Base still stretch/auto.
    expect(el.widthMode).toBe('stretch');
    expect(el.heightMode).toBe('auto');
    // Mobile override captures the fixed size.
    expect(el.breakpointOverrides?.mobile).toEqual({
      x: 0,
      y: 0,
      widthValue: 360,
      heightValue: 180,
      widthMode: 'fixed',
      heightMode: 'fixed',
    });
  });
});

describe('resetElementFieldsAtBreakpoint', () => {
  it('clears one field from an override without touching others', () => {
    resetStore(
      makeRect({
        breakpointOverrides: {
          tablet: {
            padding: [12, 12, 12, 12],
            backgroundColor: '#ff0000',
          },
        },
      }),
      'tablet'
    );
    useCanvasStore
      .getState()
      .resetElementFieldsAtBreakpoint(rectId, 'tablet', ['padding']);
    const el = useCanvasStore.getState().elements[rectId]!;
    expect(el.breakpointOverrides?.tablet).toEqual({
      backgroundColor: '#ff0000',
    });
  });

  it('drops the breakpoint key when the last override field clears', () => {
    resetStore(
      makeRect({
        breakpointOverrides: {
          tablet: { padding: [12, 12, 12, 12] },
          mobile: { padding: [8, 8, 8, 8] },
        },
      }),
      'tablet'
    );
    useCanvasStore
      .getState()
      .resetElementFieldsAtBreakpoint(rectId, 'tablet', ['padding']);
    const el = useCanvasStore.getState().elements[rectId]!;
    // Tablet key gone, mobile preserved.
    expect(el.breakpointOverrides?.tablet).toBeUndefined();
    expect(el.breakpointOverrides?.mobile).toEqual({ padding: [8, 8, 8, 8] });
  });

  it('drops the whole breakpointOverrides field when no overrides remain', () => {
    resetStore(
      makeRect({
        breakpointOverrides: {
          tablet: { padding: [12, 12, 12, 12] },
        },
      }),
      'tablet'
    );
    useCanvasStore
      .getState()
      .resetElementFieldsAtBreakpoint(rectId, 'tablet', ['padding']);
    const el = useCanvasStore.getState().elements[rectId]!;
    expect(el.breakpointOverrides).toBeUndefined();
  });

  it('is a no-op when breakpointId === desktop', () => {
    resetStore(
      makeRect({
        padding: [24, 24, 24, 24],
        breakpointOverrides: { tablet: { padding: [12, 12, 12, 12] } },
      }),
      'tablet'
    );
    useCanvasStore
      .getState()
      .resetElementFieldsAtBreakpoint(rectId, 'desktop', ['padding']);
    const el = useCanvasStore.getState().elements[rectId]!;
    expect(el.padding).toEqual([24, 24, 24, 24]);
    expect(el.breakpointOverrides?.tablet).toEqual({ padding: [12, 12, 12, 12] });
  });
});
