import { describe, expect, it } from 'vitest';
import {
  clampZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  nextZoomFromWheel,
  stepZoom,
  ZOOM_BUTTON_STEP,
  ZOOM_SENSITIVITY,
} from '../src/renderer/lib/zoom';

describe('clampZoom', () => {
  it('returns the scale unchanged when inside the range', () => {
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(0.5)).toBe(0.5);
  });

  it('clamps below the floor up to MIN_ZOOM', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(-2)).toBe(MIN_ZOOM);
  });

  it('clamps above the ceiling down to MAX_ZOOM', () => {
    expect(clampZoom(10)).toBe(MAX_ZOOM);
  });
});

describe('nextZoomFromWheel', () => {
  it('zooms out on positive deltaY (scroll down / pinch in)', () => {
    expect(nextZoomFromWheel(1, 100)).toBeLessThan(1);
  });

  it('zooms in on negative deltaY (scroll up / pinch out)', () => {
    expect(nextZoomFromWheel(1, -100)).toBeGreaterThan(1);
  });

  it('anchors on the passed current scale, not a fixed 1.0', () => {
    // Coming from a fitted 0.5, a small zoom-in step stays near 0.5.
    const next = nextZoomFromWheel(0.5, -10);
    expect(next).toBeGreaterThan(0.5);
    expect(next).toBeLessThan(0.6);
  });

  it('applies the exponential mapping with ZOOM_SENSITIVITY', () => {
    expect(nextZoomFromWheel(1, -50)).toBeCloseTo(
      Math.exp(50 * ZOOM_SENSITIVITY),
      5
    );
  });

  it('clamps the result to MIN_ZOOM on a large zoom-out delta', () => {
    expect(nextZoomFromWheel(1, 100000)).toBe(MIN_ZOOM);
  });

  it('clamps the result to MAX_ZOOM on a large zoom-in delta', () => {
    expect(nextZoomFromWheel(1, -100000)).toBe(MAX_ZOOM);
  });

  it('returns the same scale when deltaY is zero', () => {
    expect(nextZoomFromWheel(1.25, 0)).toBe(1.25);
  });
});

describe('stepZoom', () => {
  it('steps up by ZOOM_BUTTON_STEP from the current scale', () => {
    expect(stepZoom(0.6, 1)).toBeCloseTo(0.75, 5);
  });

  it('steps down by ZOOM_BUTTON_STEP from the current scale', () => {
    expect(stepZoom(0.6, -1)).toBeCloseTo(0.45, 5);
  });

  it('anchors on the passed (fit) value, not a fixed 100%', () => {
    // From a 60% fit, a single tap up must land near 75% — the old
    // ladder jumped to 125%, which this guards against.
    expect(stepZoom(0.6, 1)).toBeLessThan(1);
  });

  it('does not exceed MAX_ZOOM when stepping up near the ceiling', () => {
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
  });

  it('does not drop below MIN_ZOOM when stepping down near the floor', () => {
    expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
  });

  it('uses a 15-percentage-point step', () => {
    expect(ZOOM_BUTTON_STEP).toBe(0.15);
  });
});
