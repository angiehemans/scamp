import { describe, it, expect } from 'vitest';
import {
  formatOverflowLabel,
  overflowExtent,
  settleExtent,
} from '../src/renderer/lib/canvasOverflow';

describe('overflowExtent', () => {
  it('returns the positive difference when content overflows', () => {
    expect(overflowExtent(1680, 1440)).toBe(240);
  });

  it('returns 0 when content fits exactly', () => {
    expect(overflowExtent(1440, 1440)).toBe(0);
  });

  it('clamps to 0 when the scroll size is smaller than the client', () => {
    expect(overflowExtent(1200, 1440)).toBe(0);
  });

  it('rounds sub-pixel measurements to whole pixels', () => {
    expect(overflowExtent(1440.4, 1200.1)).toBe(240);
  });
});

describe('formatOverflowLabel', () => {
  it('formats a positive overflow', () => {
    expect(formatOverflowLabel(240)).toBe('+ 240px overflow');
  });

  it('returns an empty string for no overflow', () => {
    expect(formatOverflowLabel(0)).toBe('');
    expect(formatOverflowLabel(-10)).toBe('');
  });
});

describe('settleExtent', () => {
  it('reports the frame box when the content matches it exactly', () => {
    expect(settleExtent(1440, 1440)).toBe(1440);
  });

  it('absorbs a sub-pixel overshoot rather than reporting 1px of overflow', () => {
    // The case that made the canvas oscillate: an element exactly as wide
    // as the frame, measured a hair over at a fractional zoom.
    expect(settleExtent(1440.6, 1440)).toBe(1440);
  });

  it('absorbs a sub-pixel undershoot the same way', () => {
    expect(settleExtent(1439.4, 1440)).toBe(1440);
  });

  it('returns the same value for both sides of the wobble, so it cannot flip', () => {
    expect(settleExtent(1440.6, 1440)).toBe(settleExtent(1439.4, 1440));
  });

  it('reports genuine overflow once it exceeds the tolerance', () => {
    expect(settleExtent(1460, 1440)).toBe(1460);
  });

  it('rounds real overflow up so the boundary label never under-reports', () => {
    expect(settleExtent(1460.2, 1440)).toBe(1461);
  });

  it('treats an overshoot exactly at the tolerance as no overflow', () => {
    expect(settleExtent(1442, 1440, 2)).toBe(1440);
  });

  it('reports overflow one px past the tolerance', () => {
    expect(settleExtent(1443, 1440, 2)).toBe(1443);
  });

  it('honours an explicit tolerance of zero', () => {
    expect(settleExtent(1440.5, 1440, 0)).toBe(1441);
  });

  it('falls back to the frame box when the measurement is not finite', () => {
    // `appliedScale` is a division — a degenerate frame can yield NaN.
    expect(settleExtent(Number.NaN, 1440)).toBe(1440);
    expect(settleExtent(Number.POSITIVE_INFINITY, 1440)).toBe(1440);
  });

  it('reports the frame box for content measured smaller than it', () => {
    expect(settleExtent(200, 1440)).toBe(1440);
  });

  it('handles a zero-sized frame without reporting phantom overflow', () => {
    expect(settleExtent(0, 0)).toBe(0);
  });
});
