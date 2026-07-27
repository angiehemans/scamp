import { describe, it, expect } from 'vitest';
import {
  readableTextColor,
  LIGHT_TEXT,
  DARK_TEXT,
} from '@lib/readableTextColor';

describe('readableTextColor', () => {
  it('uses dark text on light backgrounds', () => {
    expect(readableTextColor('#ffffff')).toBe(DARK_TEXT);
    expect(readableTextColor('#fde68a')).toBe(DARK_TEXT); // light amber
    expect(readableTextColor('#e5e7eb')).toBe(DARK_TEXT);
  });

  it('uses light text on dark backgrounds', () => {
    expect(readableTextColor('#000000')).toBe(LIGHT_TEXT);
    expect(readableTextColor('#1e1e1e')).toBe(LIGHT_TEXT);
    expect(readableTextColor('#3b82f6')).toBe(LIGHT_TEXT); // mid blue
  });

  it('supports shorthand hex and rgb()/rgba()', () => {
    expect(readableTextColor('#fff')).toBe(DARK_TEXT);
    expect(readableTextColor('#000')).toBe(LIGHT_TEXT);
    expect(readableTextColor('rgb(255, 255, 255)')).toBe(DARK_TEXT);
    expect(readableTextColor('rgba(10, 10, 10, 0.9)')).toBe(LIGHT_TEXT);
  });

  it('falls back to light text for unset or unparseable colors', () => {
    expect(readableTextColor(undefined)).toBe(LIGHT_TEXT);
    expect(readableTextColor('')).toBe(LIGHT_TEXT);
    expect(readableTextColor('var(--whatever)')).toBe(LIGHT_TEXT);
    expect(readableTextColor('rebeccapurple')).toBe(LIGHT_TEXT);
  });
});
