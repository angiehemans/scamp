import { describe, it, expect } from 'vitest';
import {
  createQuietWindow,
  DEFAULT_QUIET_WINDOW_MS,
} from '@renderer/src/lib/quietWindow';

describe('quietWindow', () => {
  it('starts closed — isQuiet is false initially', () => {
    const w = createQuietWindow();
    expect(w.isQuiet(0)).toBe(false);
    expect(w.remainingMs(0)).toBe(0);
  });

  it('extend opens the window for windowMs', () => {
    const w = createQuietWindow(2500);
    w.extend(1000);
    expect(w.isQuiet(1000)).toBe(true);
    expect(w.isQuiet(2000)).toBe(true);
    expect(w.isQuiet(3499)).toBe(true);
    expect(w.isQuiet(3500)).toBe(false);
  });

  it('extend rolls forward — second call resets the deadline', () => {
    const w = createQuietWindow(2500);
    w.extend(1000);
    expect(w.isQuiet(3000)).toBe(true);
    // 1500ms later, another event extends; deadline becomes 5000.
    w.extend(2500);
    expect(w.isQuiet(4500)).toBe(true);
    expect(w.isQuiet(5000)).toBe(false);
  });

  it('remainingMs counts down to zero', () => {
    const w = createQuietWindow(2500);
    w.extend(1000);
    expect(w.remainingMs(1000)).toBe(2500);
    expect(w.remainingMs(2000)).toBe(1500);
    expect(w.remainingMs(3499)).toBe(1);
    expect(w.remainingMs(3500)).toBe(0);
    expect(w.remainingMs(10000)).toBe(0);
  });

  it('clear closes the window immediately', () => {
    const w = createQuietWindow(2500);
    w.extend(1000);
    expect(w.isQuiet(1500)).toBe(true);
    w.clear();
    expect(w.isQuiet(1500)).toBe(false);
    expect(w.remainingMs(1500)).toBe(0);
  });

  it('clear before extend is a no-op', () => {
    const w = createQuietWindow();
    w.clear();
    expect(w.isQuiet()).toBe(false);
  });

  it('uses Date.now() when `now` is omitted', () => {
    const w = createQuietWindow(1000);
    const before = Date.now();
    w.extend();
    const remaining = w.remainingMs();
    // Allow a few ms of jitter between the extend and the read.
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(1000);
    // And isQuiet agrees.
    expect(w.isQuiet()).toBe(true);
    // Sanity: less than the configured window plus jitter.
    expect(Date.now() - before).toBeLessThan(100);
  });

  it('DEFAULT_QUIET_WINDOW_MS is 2500', () => {
    expect(DEFAULT_QUIET_WINDOW_MS).toBe(2500);
  });

  it('separate instances are independent', () => {
    const a = createQuietWindow(1000);
    const b = createQuietWindow(1000);
    a.extend(0);
    expect(a.isQuiet(500)).toBe(true);
    expect(b.isQuiet(500)).toBe(false);
  });

  it('custom window duration is honoured', () => {
    const w = createQuietWindow(500);
    w.extend(0);
    expect(w.isQuiet(499)).toBe(true);
    expect(w.isQuiet(500)).toBe(false);
  });
});
