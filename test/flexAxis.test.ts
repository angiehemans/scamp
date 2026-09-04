import { describe, it, expect } from 'vitest';

import {
  baseDirection,
  isColumnDirection,
  isReverseDirection,
  selfAlignForParent,
  withReverse,
} from '@lib/flexAxis';

describe('isColumnDirection', () => {
  it('treats both column spellings as a vertical main axis', () => {
    expect(isColumnDirection('column')).toBe(true);
    expect(isColumnDirection('column-reverse')).toBe(true);
  });

  it('treats both row spellings, and no direction at all, as horizontal', () => {
    expect(isColumnDirection('row')).toBe(false);
    expect(isColumnDirection('row-reverse')).toBe(false);
    expect(isColumnDirection(undefined)).toBe(false);
  });
});

describe('isReverseDirection / baseDirection / withReverse', () => {
  it('round-trips every direction through base + reverse flag', () => {
    for (const d of ['row', 'column', 'row-reverse', 'column-reverse'] as const) {
      expect(withReverse(baseDirection(d), isReverseDirection(d))).toBe(d);
    }
  });

  it('strips the modifier for the base axis', () => {
    expect(baseDirection('row-reverse')).toBe('row');
    expect(baseDirection('column-reverse')).toBe('column');
  });
});

describe('selfAlignForParent', () => {
  it('uses the flex spelling for start / end under a flex parent', () => {
    expect(selfAlignForParent('start', 'flex')).toBe('flex-start');
    expect(selfAlignForParent('end', 'flex')).toBe('flex-end');
  });

  it('keeps the short spelling under a grid parent', () => {
    expect(selfAlignForParent('start', 'grid')).toBe('start');
    expect(selfAlignForParent('end', 'grid')).toBe('end');
  });

  it('leaves the shared values alone everywhere', () => {
    for (const v of ['auto', 'center', 'stretch', 'baseline'] as const) {
      expect(selfAlignForParent(v, 'flex')).toBe(v);
      expect(selfAlignForParent(v, 'grid')).toBe(v);
      expect(selfAlignForParent(v, undefined)).toBe(v);
    }
  });
});
