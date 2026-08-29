import { describe, it, expect } from 'vitest';

import { containerOverflow } from '@lib/canvasOverflow';

/**
 * The arithmetic behind the nested-container overflow indicator. The
 * interesting cases are the ones that must NOT light it up: a container
 * that exactly fits, and sub-pixel wobble.
 */
describe('containerOverflow', () => {
  it('reports nothing when every child fits', () => {
    expect(
      containerOverflow([{ right: 100, bottom: 50 }], 200, 100)
    ).toEqual({ x: 0, y: 0 });
  });

  it('reports the furthest spill, not the sum', () => {
    // Flex children sit side by side; the container overflows by however
    // far the last one reaches, not by how much total width they want.
    expect(
      containerOverflow(
        [
          { right: 150, bottom: 40 },
          { right: 260, bottom: 40 },
          { right: 200, bottom: 40 },
        ],
        200,
        100
      )
    ).toEqual({ x: 60, y: 0 });
  });

  it('reports each axis independently', () => {
    expect(
      containerOverflow([{ right: 100, bottom: 180 }], 200, 100)
    ).toEqual({ x: 0, y: 80 });
  });

  it('stays silent for an exact fit', () => {
    expect(
      containerOverflow([{ right: 200, bottom: 100 }], 200, 100)
    ).toEqual({ x: 0, y: 0 });
  });

  it('stays silent for sub-pixel wobble', () => {
    // A child measured a hair over its container at a fractional zoom
    // must not light an indicator on and off.
    expect(
      containerOverflow([{ right: 200.4, bottom: 100.4 }], 200, 100)
    ).toEqual({ x: 0, y: 0 });
  });

  it('rounds a real spill to whole pixels', () => {
    expect(
      containerOverflow([{ right: 260.6, bottom: 100 }], 200, 100)
    ).toEqual({ x: 61, y: 0 });
  });

  it('reports nothing for a container with no children', () => {
    expect(containerOverflow([], 200, 100)).toEqual({ x: 0, y: 0 });
  });

  it('never reports a negative overflow', () => {
    expect(
      containerOverflow([{ right: 10, bottom: 10 }], 200, 100)
    ).toEqual({ x: 0, y: 0 });
  });
});
