import { describe, it, expect } from 'vitest';

import { tokensForField } from '@lib/tokensForField';
import type { ThemeToken } from '@shared/types';

const tokens = (map: Record<string, string>): ThemeToken[] =>
  Object.entries(map).map(([name, value]) => ({ name, value }));

const ALL = tokens({
  '--color-primary': 'var(--color-brand-500)',
  '--font-sans': 'system-ui',
  '--text-base': '1rem',
  '--text-h1-size': '2.5rem', // text-style internal
  '--leading-normal': '1.5',
  '--space-4': '16px',
  '--border-thin': '1px',
  '--radius-md': '8px',
  '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
});

const names = (ts: ThemeToken[]): string[] => ts.map((t) => t.name);

describe('tokensForField', () => {
  it('fontFamily → only family tokens (excludes lengths + text-style internals)', () => {
    expect(names(tokensForField('fontFamily', ALL))).toEqual(['--font-sans']);
  });

  it('fontSize → type scale first, excludes design-role + text-style internals', () => {
    const result = names(tokensForField('fontSize', ALL));
    expect(result[0]).toBe('--text-base');
    expect(result).not.toContain('--space-4');
    expect(result).not.toContain('--radius-md');
    expect(result).not.toContain('--text-h1-size');
  });

  it('lineHeight → only unitless line-height tokens', () => {
    expect(names(tokensForField('lineHeight', ALL))).toEqual([
      '--leading-normal',
    ]);
  });

  it('borderWidth → all length tokens, --border first', () => {
    const result = names(tokensForField('borderWidth', ALL));
    expect(result[0]).toBe('--border-thin');
    // Keeps the other length tokens (prioritize, not filter).
    expect(result).toContain('--space-4');
    expect(result).toContain('--radius-md');
    // Text-style internals are dropped.
    expect(result).not.toContain('--text-h1-size');
    // Non-lengths excluded.
    expect(result).not.toContain('--color-primary');
    expect(result).not.toContain('--font-sans');
  });

  it('radius → --radius first among the length tokens', () => {
    expect(names(tokensForField('radius', ALL))[0]).toBe('--radius-md');
  });

  it('spacing → --space first among the length tokens', () => {
    expect(names(tokensForField('spacing', ALL))[0]).toBe('--space-4');
  });

  it('shadow → only --shadow-* tokens', () => {
    expect(names(tokensForField('shadow', ALL))).toEqual(['--shadow-sm']);
  });
});
