import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@store/canvasSlice';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import {
  ROOT_ELEMENT_ID,
  type ElementAnimation,
  type ScampElement,
} from '@lib/element';
import { PRESETS_BY_NAME } from '@lib/animationPresets';

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

const resetStore = (el: ScampElement): void => {
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
    activeBreakpointId: 'desktop',
    activeStateName: null,
    pageKeyframesBlocks: [],
    previewAnimation: null,
  });
};

const fadeInUp: ElementAnimation = {
  name: 'fade-in-up',
  isPreset: true,
  durationMs: 300,
  easing: 'ease',
  delayMs: 0,
  iterationCount: 1,
  direction: 'normal',
  fillMode: 'forwards',
  playState: 'running',
};

const shake: ElementAnimation = {
  name: 'shake',
  isPreset: true,
  durationMs: 500,
  easing: 'ease-in-out',
  delayMs: 0,
  iterationCount: 1,
  direction: 'normal',
  fillMode: 'none',
  playState: 'running',
};

describe('setAnimation routing', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      activeBreakpointId: 'desktop',
      activeStateName: null,
      pageKeyframesBlocks: [],
      previewAnimation: null,
    });
  });

  it('writes to element.animation when default state is active', () => {
    resetStore(makeRect());
    useCanvasStore.getState().setAnimation(rectId, fadeInUp);
    const el = useCanvasStore.getState().elements[rectId];
    expect(el?.animation).toEqual(fadeInUp);
    expect(el?.stateOverrides).toBeUndefined();
  });

  it('writes to stateOverrides.hover.animation when hover is active', () => {
    resetStore(makeRect());
    useCanvasStore.getState().setActiveState('hover');
    useCanvasStore.getState().setAnimation(rectId, shake);
    const el = useCanvasStore.getState().elements[rectId];
    expect(el?.animation).toBeUndefined();
    expect(el?.stateOverrides?.hover?.animation).toEqual(shake);
  });

  it('appends a canonical preset KeyframesBlock when missing', () => {
    resetStore(makeRect());
    useCanvasStore.getState().setAnimation(rectId, fadeInUp);
    const blocks = useCanvasStore.getState().pageKeyframesBlocks;
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.name).toBe('fade-in-up');
    expect(blocks[0]?.body).toBe(PRESETS_BY_NAME.get('fade-in-up')?.body);
    expect(blocks[0]?.isPreset).toBe(true);
  });

  it('does not duplicate the keyframes block when two elements use the same preset', () => {
    resetStore(makeRect());
    useCanvasStore.getState().setAnimation(rectId, fadeInUp);
    // Add a second element and apply the same preset.
    const second: ScampElement = makeRect({ id: 'c3d4' });
    useCanvasStore.setState((s) => ({
      elements: { ...s.elements, c3d4: second },
    }));
    useCanvasStore.getState().setAnimation('c3d4', fadeInUp);
    const blocks = useCanvasStore.getState().pageKeyframesBlocks;
    expect(blocks.length).toBe(1);
  });

  it('preserves an agent-edited preset block instead of overwriting', () => {
    resetStore(makeRect());
    useCanvasStore.setState({
      pageKeyframesBlocks: [
        {
          name: 'fade-in-up',
          body: '  /* edited by an agent */\n  from { opacity: 0.5; }\n  to { opacity: 1; }',
          isPreset: false,
        },
      ],
    });
    useCanvasStore.getState().setAnimation(rectId, fadeInUp);
    const blocks = useCanvasStore.getState().pageKeyframesBlocks;
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.body).toContain('edited by an agent');
  });

  it('does not append a keyframes block for unknown (non-preset) names', () => {
    resetStore(makeRect());
    const customAnim: ElementAnimation = {
      ...fadeInUp,
      name: 'myCustom',
      isPreset: false,
    };
    useCanvasStore.getState().setAnimation(rectId, customAnim);
    expect(useCanvasStore.getState().pageKeyframesBlocks).toEqual([]);
  });
});

describe('removeAnimation routing', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      activeBreakpointId: 'desktop',
      activeStateName: null,
    });
  });

  it('clears element.animation when default state is active', () => {
    resetStore(makeRect({ animation: fadeInUp }));
    useCanvasStore.getState().removeAnimation(rectId);
    const el = useCanvasStore.getState().elements[rectId];
    expect(el?.animation).toBeUndefined();
  });

  it('clears stateOverrides.hover.animation when hover is active', () => {
    resetStore(
      makeRect({
        stateOverrides: { hover: { animation: shake } },
      })
    );
    useCanvasStore.getState().setActiveState('hover');
    useCanvasStore.getState().removeAnimation(rectId);
    const el = useCanvasStore.getState().elements[rectId];
    // Override removed; no other fields means the whole stateOverrides drops.
    expect(el?.stateOverrides).toBeUndefined();
  });

  it('does NOT remove the keyframes block from the page', () => {
    resetStore(makeRect({ animation: fadeInUp }));
    useCanvasStore.setState({
      pageKeyframesBlocks: [
        { name: 'fade-in-up', body: '  from { opacity: 0; }\n  to { opacity: 1; }', isPreset: true },
      ],
    });
    useCanvasStore.getState().removeAnimation(rectId);
    expect(useCanvasStore.getState().pageKeyframesBlocks.length).toBe(1);
  });
});

describe('playAnimation', () => {
  beforeEach(() => {
    useCanvasStore.setState({ previewAnimation: null });
  });

  it('sets previewAnimation with an incrementing key per click', () => {
    resetStore(makeRect({ animation: fadeInUp }));
    useCanvasStore.getState().playAnimation(rectId);
    const first = useCanvasStore.getState().previewAnimation;
    expect(first?.elementId).toBe(rectId);
    expect(first?.key).toBe(1);
    useCanvasStore.getState().playAnimation(rectId);
    const second = useCanvasStore.getState().previewAnimation;
    expect(second?.key).toBe(2);
  });

  it('resets the key when switching to a different element', () => {
    resetStore(makeRect({ animation: fadeInUp }));
    useCanvasStore.getState().playAnimation(rectId);
    expect(useCanvasStore.getState().previewAnimation?.key).toBe(1);
    useCanvasStore.getState().playAnimation('other-id');
    const next = useCanvasStore.getState().previewAnimation;
    expect(next?.elementId).toBe('other-id');
    expect(next?.key).toBe(1);
  });
});
