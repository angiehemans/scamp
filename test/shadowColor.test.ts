import { describe, it, expect } from 'vitest';
import { combineShadowColor, splitShadowColor } from '@lib/parsers';

describe('splitShadowColor', () => {
  it('splits an opaque hex into base + alpha=1', () => {
    expect(splitShadowColor('#3b82f6')).toEqual({
      base: '#3b82f6',
      alpha: 1,
      decomposable: true,
      hasExplicitAlpha: false,
    });
  });

  it('expands a 3-digit hex to 6-digit form', () => {
    expect(splitShadowColor('#abc')).toEqual({
      base: '#aabbcc',
      alpha: 1,
      decomposable: true,
      hasExplicitAlpha: false,
    });
  });

  it('lowercases hex output regardless of input case', () => {
    expect(splitShadowColor('#FF00AA').base).toBe('#ff00aa');
  });

  it('splits rgba into hex base + alpha 0..1', () => {
    expect(splitShadowColor('rgba(0, 0, 0, 0.15)')).toEqual({
      base: '#000000',
      alpha: 0.15,
      decomposable: true,
      hasExplicitAlpha: true,
    });
  });

  it('treats rgb(...) (no alpha) as alpha=1, hasExplicitAlpha=false', () => {
    expect(splitShadowColor('rgb(255, 100, 50)')).toEqual({
      base: '#ff6432',
      alpha: 1,
      decomposable: true,
      hasExplicitAlpha: false,
    });
  });

  it('clamps alpha values outside 0..1', () => {
    expect(splitShadowColor('rgba(0, 0, 0, 2)').alpha).toBe(1);
    expect(splitShadowColor('rgba(0, 0, 0, -0.5)').alpha).toBe(0);
  });

  it('marks var() values as non-decomposable', () => {
    expect(splitShadowColor('var(--shadow-color)')).toEqual({
      base: 'var(--shadow-color)',
      alpha: 1,
      decomposable: false,
      hasExplicitAlpha: false,
    });
  });

  it('marks currentColor and named colors as non-decomposable', () => {
    expect(splitShadowColor('currentColor').decomposable).toBe(false);
    expect(splitShadowColor('rebeccapurple').decomposable).toBe(false);
  });

  it('returns a sane default for empty input', () => {
    expect(splitShadowColor('').base).toBe('#000000');
    expect(splitShadowColor('').alpha).toBe(1);
  });
});

describe('combineShadowColor', () => {
  it('combines a hex with full alpha as rgba(..., 1)', () => {
    expect(combineShadowColor('#3b82f6', 1)).toBe('rgba(59, 130, 246, 1)');
  });

  it('combines a hex with partial alpha into rgba', () => {
    expect(combineShadowColor('#000000', 0.15)).toBe('rgba(0, 0, 0, 0.15)');
  });

  it('expands a 3-digit hex on combine', () => {
    expect(combineShadowColor('#abc', 0.5)).toBe('rgba(170, 187, 204, 0.5)');
  });

  it('keeps an existing rgb(...) base (overwrites alpha)', () => {
    expect(combineShadowColor('rgb(10, 20, 30)', 0.4)).toBe(
      'rgba(10, 20, 30, 0.4)'
    );
  });

  it('clamps alpha out of range', () => {
    expect(combineShadowColor('#000000', 1.5)).toBe('rgba(0, 0, 0, 1)');
    expect(combineShadowColor('#000000', -1)).toBe('rgba(0, 0, 0, 0)');
  });

  it('passes var() through unchanged (alpha cannot apply)', () => {
    expect(combineShadowColor('var(--shadow-color)', 0.3)).toBe(
      'var(--shadow-color)'
    );
  });

  it('passes named colors through unchanged', () => {
    expect(combineShadowColor('currentColor', 0.5)).toBe('currentColor');
  });

  it('returns an empty string for empty input', () => {
    expect(combineShadowColor('', 0.5)).toBe('');
  });

  it('emits short alpha decimals (no float noise)', () => {
    // 0.1 + 0.2 in JS is 0.30000000000000004 — formatter keeps it terse.
    expect(combineShadowColor('#000000', 0.1 + 0.2)).toBe('rgba(0, 0, 0, 0.3)');
  });
});

describe('split + combine round-trip', () => {
  it('round-trips an rgba shadow color', () => {
    const original = 'rgba(0, 0, 0, 0.15)';
    const split = splitShadowColor(original);
    expect(combineShadowColor(split.base, split.alpha)).toBe(original);
  });

  it('round-trips a hex by promoting it to rgba(..., 1)', () => {
    const original = '#3b82f6';
    const split = splitShadowColor(original);
    expect(combineShadowColor(split.base, split.alpha)).toBe(
      'rgba(59, 130, 246, 1)'
    );
  });

  it('round-trips a token by passing through unchanged', () => {
    const original = 'var(--shadow-color)';
    const split = splitShadowColor(original);
    expect(combineShadowColor(split.base, split.alpha)).toBe(original);
  });
});
