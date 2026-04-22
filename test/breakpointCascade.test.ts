import { describe, it, expect } from 'vitest';
import { resolveElementAtBreakpoint } from '@lib/breakpointCascade';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { type ScampElement } from '@lib/element';
import { DEFAULT_BREAKPOINTS } from '@shared/types';

const makeRect = (overrides: Partial<ScampElement> & { id: string }): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  type: 'rectangle',
  parentId: 'root',
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  ...overrides,
});

describe('resolveElementAtBreakpoint', () => {
  it('returns the element unchanged when active is desktop', () => {
    const el = makeRect({
      id: 'a1b2',
      padding: [24, 24, 24, 24],
      breakpointOverrides: { tablet: { padding: [12, 12, 12, 12] } },
    });
    const resolved = resolveElementAtBreakpoint(el, 'desktop', DEFAULT_BREAKPOINTS);
    expect(resolved).toBe(el);
  });

  it('applies a matching breakpoint override on top of base', () => {
    const el = makeRect({
      id: 'a1b2',
      padding: [24, 24, 24, 24],
      breakpointOverrides: { tablet: { padding: [12, 12, 12, 12] } },
    });
    const resolved = resolveElementAtBreakpoint(el, 'tablet', DEFAULT_BREAKPOINTS);
    expect(resolved.padding).toEqual([12, 12, 12, 12]);
  });

  it('cascades: at mobile, tablet override also applies, then mobile wins', () => {
    const el = makeRect({
      id: 'a1b2',
      padding: [24, 24, 24, 24],
      backgroundColor: '#000000',
      breakpointOverrides: {
        tablet: { padding: [12, 12, 12, 12], backgroundColor: '#ff0000' },
        mobile: { padding: [8, 8, 8, 8] },
      },
    });
    const resolved = resolveElementAtBreakpoint(el, 'mobile', DEFAULT_BREAKPOINTS);
    // Mobile overrides padding (narrower wins).
    expect(resolved.padding).toEqual([8, 8, 8, 8]);
    // Tablet's background carries through because mobile didn't override it.
    expect(resolved.backgroundColor).toBe('#ff0000');
  });

  it('tablet override does NOT apply when active is desktop (broader breakpoints never apply upward)', () => {
    const el = makeRect({
      id: 'a1b2',
      padding: [24, 24, 24, 24],
      breakpointOverrides: { tablet: { padding: [12, 12, 12, 12] } },
    });
    const resolved = resolveElementAtBreakpoint(el, 'desktop', DEFAULT_BREAKPOINTS);
    expect(resolved.padding).toEqual([24, 24, 24, 24]);
  });

  it('mobile override does NOT apply when active is tablet', () => {
    const el = makeRect({
      id: 'a1b2',
      padding: [24, 24, 24, 24],
      breakpointOverrides: {
        mobile: { padding: [8, 8, 8, 8] },
      },
    });
    const resolved = resolveElementAtBreakpoint(el, 'tablet', DEFAULT_BREAKPOINTS);
    expect(resolved.padding).toEqual([24, 24, 24, 24]);
  });

  it('merges customProperties across breakpoints (not replace)', () => {
    const el = makeRect({
      id: 'a1b2',
      customProperties: { transform: 'rotate(5deg)' },
      breakpointOverrides: {
        mobile: {
          customProperties: { 'box-shadow': '0 2px 8px black' },
        },
      },
    });
    const resolved = resolveElementAtBreakpoint(el, 'mobile', DEFAULT_BREAKPOINTS);
    expect(resolved.customProperties).toEqual({
      transform: 'rotate(5deg)',
      'box-shadow': '0 2px 8px black',
    });
  });

  it('returns element unchanged when the breakpoint has no override object', () => {
    const el = makeRect({ id: 'a1b2', padding: [24, 24, 24, 24] });
    const resolved = resolveElementAtBreakpoint(el, 'mobile', DEFAULT_BREAKPOINTS);
    expect(resolved).toBe(el);
  });

  it('returns element unchanged when the active breakpoint is unknown', () => {
    const el = makeRect({
      id: 'a1b2',
      padding: [24, 24, 24, 24],
      breakpointOverrides: { tablet: { padding: [12, 12, 12, 12] } },
    });
    const resolved = resolveElementAtBreakpoint(
      el,
      'some-bogus-id',
      DEFAULT_BREAKPOINTS
    );
    expect(resolved).toBe(el);
  });

  it('applies width override cleanly', () => {
    const el = makeRect({
      id: 'a1b2',
      widthMode: 'fixed',
      widthValue: 800,
      breakpointOverrides: {
        mobile: { widthMode: 'stretch' },
      },
    });
    const resolved = resolveElementAtBreakpoint(el, 'mobile', DEFAULT_BREAKPOINTS);
    expect(resolved.widthMode).toBe('stretch');
    // widthValue not overridden — base value preserved.
    expect(resolved.widthValue).toBe(800);
  });
});
