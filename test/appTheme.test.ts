import { describe, it, expect } from 'vitest';

import { normalizeTheme, THEME_STORAGE_KEY } from '@lib/appTheme';

describe('normalizeTheme', () => {
  it('keeps an explicit light theme', () => {
    expect(normalizeTheme('light')).toBe('light');
  });

  it('keeps an explicit dark theme', () => {
    expect(normalizeTheme('dark')).toBe('dark');
  });

  it('falls back to dark for unknown, empty, or non-string values', () => {
    expect(normalizeTheme('solarized')).toBe('dark');
    expect(normalizeTheme('')).toBe('dark');
    expect(normalizeTheme(undefined)).toBe('dark');
    expect(normalizeTheme(null)).toBe('dark');
    expect(normalizeTheme(42)).toBe('dark');
    expect(normalizeTheme({ theme: 'light' })).toBe('dark');
  });
});

describe('THEME_STORAGE_KEY', () => {
  it('is the stable key the boot script and helper agree on', () => {
    expect(THEME_STORAGE_KEY).toBe('scamp.theme');
  });
});
