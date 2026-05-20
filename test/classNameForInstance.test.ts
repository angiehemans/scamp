import { describe, it, expect } from 'vitest';
import { classNameFor } from '@lib/generateCode';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';

const makeInstance = (
  overrides: Partial<ScampElement> & { id: string }
): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  type: 'component-instance',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  propOverrides: {},
  ...overrides,
});

describe('classNameFor — component-instance branch', () => {
  it('returns the explicit instanceId when set', () => {
    const el = makeInstance({
      id: 'a1b2',
      componentName: 'Button',
      instanceId: 'inst_a1b2',
    });
    expect(classNameFor(el)).toBe('inst_a1b2');
  });

  it('falls back to a synthesised `inst_<id>` when instanceId is absent', () => {
    const el = makeInstance({
      id: 'c3d4',
      componentName: 'Button',
      // intentionally omit instanceId
    });
    expect(classNameFor(el)).toBe('inst_c3d4');
  });

  it('does not return a rect_ / text_ class prefix for instances', () => {
    const el = makeInstance({
      id: 'a1b2',
      componentName: 'Button',
      instanceId: 'inst_a1b2',
    });
    const result = classNameFor(el);
    expect(result.startsWith('rect_')).toBe(false);
    expect(result.startsWith('text_')).toBe(false);
  });
});
