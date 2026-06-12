import { describe, it, expect } from 'vitest';

import {
  elementToStyle,
  canvasRenderTag,
  CANVAS_SKIP_ATTRS_BY_TAG,
} from '@lib/elementToStyle';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';
import type { ThemeToken } from '@shared/types';

const makeEl = (overrides: Partial<ScampElement> = {}): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id: 'rect_a1b2',
  type: 'rectangle',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  minHeight: '100vh',
  customProperties: {},
  ...overrides,
});

type StyleOpts = {
  parentDisplay?: 'flex' | 'grid' | 'none' | undefined;
  parentDirection?: 'row' | 'column' | undefined;
  tokens?: ReadonlyArray<ThemeToken>;
  isInstanceInner?: boolean;
  rootMinHeight?: number;
};

const style = (el: ScampElement, o: StyleOpts = {}): Record<string, unknown> =>
  elementToStyle(
    el,
    o.parentDisplay,
    o.parentDirection,
    o.tokens ?? [],
    null,
    'nextjs',
    o.isInstanceInner ?? false,
    o.rootMinHeight ?? 900
  ) as Record<string, unknown>;

describe('canvasRenderTag', () => {
  it('swaps dialog and svg for div (a real one would interfere with the canvas)', () => {
    expect(canvasRenderTag('dialog')).toBe('div');
    expect(canvasRenderTag('svg')).toBe('div');
  });

  it('passes every other tag through unchanged', () => {
    expect(canvasRenderTag('div')).toBe('div');
    expect(canvasRenderTag('span')).toBe('span');
    expect(canvasRenderTag('button')).toBe('button');
  });
});

describe('CANVAS_SKIP_ATTRS_BY_TAG', () => {
  it('skips the side-effecting attributes per tag', () => {
    expect(CANVAS_SKIP_ATTRS_BY_TAG.a?.has('href')).toBe(true);
    expect(CANVAS_SKIP_ATTRS_BY_TAG.a?.has('target')).toBe(true);
    expect(CANVAS_SKIP_ATTRS_BY_TAG.dialog?.has('open')).toBe(true);
    expect(CANVAS_SKIP_ATTRS_BY_TAG.form?.has('action')).toBe(true);
    expect(CANVAS_SKIP_ATTRS_BY_TAG.button?.has('type')).toBe(true);
  });

  it('has no entry for tags without side effects', () => {
    expect(CANVAS_SKIP_ATTRS_BY_TAG.div).toBeUndefined();
  });
});

describe('elementToStyle — width/height modes', () => {
  it('fixed mode uses the numeric value (React appends px)', () => {
    expect(style(makeEl({ widthMode: 'fixed', widthValue: 120 })).width).toBe(
      120
    );
    expect(
      style(makeEl({ heightMode: 'fixed', heightValue: 64 })).height
    ).toBe(64);
  });

  it('a verbatim widthCustom wins over the px fallback in fixed mode', () => {
    expect(
      style(makeEl({ widthMode: 'fixed', widthCustom: '50vh' })).width
    ).toBe('50vh');
  });

  it('stretch maps to 100% outside a flex parent', () => {
    expect(style(makeEl({ widthMode: 'stretch' })).width).toBe('100%');
  });

  it('fit-content maps to the keyword', () => {
    expect(style(makeEl({ widthMode: 'fit-content' })).width).toBe(
      'fit-content'
    );
  });

  it('auto produces undefined so the element inherits the browser default', () => {
    expect(style(makeEl({ widthMode: 'auto' })).width).toBeUndefined();
  });
});

describe('elementToStyle — flex parent stretch routing', () => {
  it('main-axis stretch in a row parent becomes flex:1 and drops the size', () => {
    const s = style(makeEl({ widthMode: 'stretch' }), {
      parentDisplay: 'flex',
      parentDirection: 'row',
    });
    expect(s.flex).toBe(1);
    expect(s.minWidth).toBe(0);
    expect(s.width).toBeUndefined();
  });

  it('cross-axis stretch in a row parent becomes align-self:stretch', () => {
    const s = style(makeEl({ heightMode: 'stretch' }), {
      parentDisplay: 'flex',
      parentDirection: 'row',
    });
    expect(s.alignSelf).toBe('stretch');
    expect(s.height).toBeUndefined();
  });
});

describe('elementToStyle — root vs instance-inner', () => {
  it('the page root renders without a fixed height (it grows via min-height)', () => {
    const rootEl = makeEl({ id: ROOT_ELEMENT_ID, heightMode: 'fixed', heightValue: 300 });
    expect(style(rootEl).height).toBeUndefined();
  });

  it('a non-root element keeps its fixed height', () => {
    const el = makeEl({ heightMode: 'fixed', heightValue: 300 });
    expect(style(el).height).toBe(300);
  });

  it('the same root id rendered as an instance-inner subtree is NOT treated as root', () => {
    const rootEl = makeEl({ id: ROOT_ELEMENT_ID, heightMode: 'fixed', heightValue: 300 });
    expect(style(rootEl, { isInstanceInner: true }).height).toBe(300);
  });
});

describe('elementToStyle — theme token resolution', () => {
  it('resolves a var(--token) font-family against the theme tokens', () => {
    const tokens: ReadonlyArray<ThemeToken> = [
      { name: '--font-sans', value: 'Inter, sans-serif' },
    ];
    const el = makeEl({ type: 'text', text: 'hi', fontFamily: 'var(--font-sans)' });
    expect(style(el, { tokens }).fontFamily).toBe('Inter, sans-serif');
  });

  it('leaves an unknown token as the raw value (browser falls back)', () => {
    const el = makeEl({ type: 'text', text: 'hi', fontFamily: 'var(--missing)' });
    expect(style(el, { tokens: [] }).fontFamily).toBe('var(--missing)');
  });
});
