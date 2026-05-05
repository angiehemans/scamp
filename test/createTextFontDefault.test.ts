import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@store/canvasSlice';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { DEFAULT_BODY_FONT_FAMILY } from '@shared/agentMd';
import type { ThemeToken } from '@shared/types';

/**
 * Tests the store's createText action picks up the project's default
 * font from theme tokens. Mirrors the agent.md convention so canvas-
 * created text and agent-written text both pick the same default.
 */

const seedStore = (themeTokens: ReadonlyArray<ThemeToken>): void => {
  useCanvasStore.setState({
    elements: {
      [ROOT_ELEMENT_ID]: {
        ...DEFAULT_RECT_STYLES,
        id: ROOT_ELEMENT_ID,
        type: 'rectangle',
        parentId: null,
        childIds: [],
        x: 0,
        y: 0,
        customProperties: {},
      },
    },
    rootElementId: ROOT_ELEMENT_ID,
    selectedElementIds: [],
    themeTokens: [...themeTokens],
  });
};

describe('createText — font-family default', () => {
  beforeEach(() => {
    // Clear before each test so previous state doesn't bleed over.
    seedStore([]);
  });

  it('picks `var(--font-sans)` when the theme declares the token', () => {
    seedStore([
      { name: '--color-primary', value: '#3b82f6' },
      { name: '--font-sans', value: 'system-ui, sans-serif' },
    ]);
    const id = useCanvasStore.getState().createText({
      parentId: ROOT_ELEMENT_ID,
      x: 10,
      y: 20,
    });
    const text = useCanvasStore.getState().elements[id];
    expect(text?.fontFamily).toBe('var(--font-sans)');
  });

  it('falls back to the literal system stack when --font-sans is missing', () => {
    seedStore([{ name: '--color-primary', value: '#3b82f6' }]);
    const id = useCanvasStore.getState().createText({
      parentId: ROOT_ELEMENT_ID,
      x: 10,
      y: 20,
    });
    const text = useCanvasStore.getState().elements[id];
    expect(text?.fontFamily).toBe(DEFAULT_BODY_FONT_FAMILY);
  });

  it('falls back to the system stack when the theme has no tokens at all', () => {
    seedStore([]);
    const id = useCanvasStore.getState().createText({
      parentId: ROOT_ELEMENT_ID,
      x: 10,
      y: 20,
    });
    const text = useCanvasStore.getState().elements[id];
    expect(text?.fontFamily).toBe(DEFAULT_BODY_FONT_FAMILY);
  });

  it('keeps the other text defaults untouched (size, weight, color, align)', () => {
    seedStore([{ name: '--font-sans', value: 'system-ui, sans-serif' }]);
    const id = useCanvasStore.getState().createText({
      parentId: ROOT_ELEMENT_ID,
      x: 0,
      y: 0,
    });
    const text = useCanvasStore.getState().elements[id];
    expect(text?.fontSize).toBe('14px');
    expect(text?.fontWeight).toBe(400);
    expect(text?.color).toBe('#222222');
    expect(text?.textAlign).toBe('left');
  });

  it('defaults width and height to fit-content so the box hugs the text', () => {
    seedStore([]);
    const id = useCanvasStore.getState().createText({
      parentId: ROOT_ELEMENT_ID,
      x: 0,
      y: 0,
    });
    const text = useCanvasStore.getState().elements[id];
    expect(text?.widthMode).toBe('fit-content');
    expect(text?.heightMode).toBe('fit-content');
  });
});
