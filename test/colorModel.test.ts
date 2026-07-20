import { describe, it, expect } from 'vitest';

import { buildColorModel } from '@lib/colorModel';
import type { ThemeToken } from '@shared/types';

const tokens = (map: Record<string, string>): ThemeToken[] =>
  Object.entries(map).map(([name, value]) => ({ name, value }));

describe('buildColorModel', () => {
  it('groups numeric-shade tokens into primitive palettes, sorted by shade', () => {
    const { palettes } = buildColorModel(
      tokens({
        '--color-brand-500': '#3b82f6',
        '--color-brand-50': '#eff6ff',
        '--color-brand-900': '#1e3a8a',
        '--color-neutral-0': '#ffffff',
      })
    );
    const brand = palettes.find((p) => p.name === 'brand');
    expect(brand?.shades.map((s) => s.shade)).toEqual([50, 500, 900]);
    expect(brand?.shades[0]).toEqual({
      shade: 50,
      name: '--color-brand-50',
      value: '#eff6ff',
    });
    expect(palettes.find((p) => p.name === 'neutral')?.shades[0]?.shade).toBe(0);
  });

  it('treats non-numeric-suffix color tokens as semantic and resolves them', () => {
    const { semantic } = buildColorModel(
      tokens({
        '--color-brand-500': '#3b82f6',
        '--color-brand': 'var(--color-brand-500)',
        '--color-background': '#ffffff',
      })
    );
    const brand = semantic.find((s) => s.name === '--color-brand');
    expect(brand).toEqual({
      name: '--color-brand',
      value: 'var(--color-brand-500)',
      resolved: '#3b82f6',
    });
    const bg = semantic.find((s) => s.name === '--color-background');
    expect(bg?.resolved).toBe('#ffffff');
  });

  it('reports a null resolved value for a semantic token with a broken reference', () => {
    const { semantic } = buildColorModel(
      tokens({ '--color-brand': 'var(--color-gone)' })
    );
    expect(semantic[0]?.resolved).toBeNull();
  });

  it('handles a multi-word palette name', () => {
    const { palettes } = buildColorModel(
      tokens({ '--color-brand-accent-500': '#3b82f6' })
    );
    expect(palettes[0]?.name).toBe('brand-accent');
    expect(palettes[0]?.shades[0]?.shade).toBe(500);
  });

  it('ignores non-color tokens entirely', () => {
    const model = buildColorModel(
      tokens({ '--space-4': '16px', '--font-sans': "'Inter', sans-serif" })
    );
    expect(model.palettes).toEqual([]);
    expect(model.semantic).toEqual([]);
  });
});
