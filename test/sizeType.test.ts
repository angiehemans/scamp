import { describe, it, expect } from 'vitest';
import {
  sizeTypeOf,
  sizeTypeLabel,
  sizeTypeHasNumber,
  rawForType,
  combineTypedWithType,
  type SizeType,
} from '@lib/sizeType';

describe('sizeTypeOf', () => {
  it('maps the keyword modes', () => {
    expect(sizeTypeOf('stretch', undefined)).toBe('fill');
    expect(sizeTypeOf('fit-content', undefined)).toBe('hug');
    expect(sizeTypeOf('auto', undefined)).toBe('auto');
  });

  it('treats fixed with no custom as px', () => {
    expect(sizeTypeOf('fixed', undefined)).toBe('px');
    expect(sizeTypeOf('fixed', '')).toBe('px');
  });

  it('reads the unit from a fixed custom string', () => {
    expect(sizeTypeOf('fixed', '50%')).toBe('percent');
    expect(sizeTypeOf('fixed', '80vh')).toBe('vh');
    expect(sizeTypeOf('fixed', '40vw')).toBe('vw');
  });

  it('falls back to custom for calc / var / other units', () => {
    expect(sizeTypeOf('fixed', 'calc(100% - 20px)')).toBe('custom');
    expect(sizeTypeOf('fixed', 'var(--w)')).toBe('custom');
    expect(sizeTypeOf('fixed', '2rem')).toBe('custom');
  });
});

describe('sizeTypeLabel', () => {
  it('gives a short label per type', () => {
    expect(sizeTypeLabel('px')).toBe('px');
    expect(sizeTypeLabel('percent')).toBe('%');
    expect(sizeTypeLabel('fill')).toBe('Fill');
    expect(sizeTypeLabel('hug')).toBe('Hug');
    expect(sizeTypeLabel('auto')).toBe('Auto');
    expect(sizeTypeLabel('custom')).toBe('CSS');
  });
});

describe('sizeTypeHasNumber', () => {
  it('is false only for the keyword modes', () => {
    expect(sizeTypeHasNumber('fill')).toBe(false);
    expect(sizeTypeHasNumber('hug')).toBe(false);
    expect(sizeTypeHasNumber('auto')).toBe(false);
    expect(sizeTypeHasNumber('px')).toBe(true);
    expect(sizeTypeHasNumber('percent')).toBe(true);
    expect(sizeTypeHasNumber('custom')).toBe(true);
  });
});

describe('rawForType', () => {
  it('seeds unit types with the number', () => {
    expect(rawForType('px', 120)).toBe('120px');
    expect(rawForType('percent', 50)).toBe('50%');
    expect(rawForType('vh', 80)).toBe('80vh');
    expect(rawForType('vw', 40)).toBe('40vw');
  });

  it('emits keyword lengths for the mode types', () => {
    expect(rawForType('fill', 999)).toBe('100%');
    expect(rawForType('hug', 999)).toBe('fit-content');
    expect(rawForType('auto', 999)).toBe('auto');
  });
});

describe('combineTypedWithType', () => {
  it('appends the active unit to a bare number', () => {
    expect(combineTypedWithType('50', 'percent')).toBe('50%');
    expect(combineTypedWithType('120', 'px')).toBe('120px');
    expect(combineTypedWithType('80', 'vh')).toBe('80vh');
  });

  it('appends px when a number is typed under a keyword type', () => {
    // Typing a number while in Fill/Hug/Auto means "make it a fixed px size".
    expect(combineTypedWithType('200', 'fill')).toBe('200px');
    expect(combineTypedWithType('200', 'auto')).toBe('200px');
  });

  it('respects a full CSS length or keyword typed verbatim', () => {
    expect(combineTypedWithType('50vh', 'px')).toBe('50vh');
    expect(combineTypedWithType('auto', 'px')).toBe('auto');
    expect(combineTypedWithType('calc(100% - 8px)', 'percent')).toBe(
      'calc(100% - 8px)'
    );
  });

  it('passes an empty string through (parses to auto downstream)', () => {
    expect(combineTypedWithType('   ', 'px')).toBe('');
  });

  it('accepts every type in rawForType without throwing', () => {
    const types: SizeType[] = [
      'px',
      'percent',
      'fill',
      'hug',
      'auto',
      'vh',
      'vw',
      'custom',
    ];
    for (const t of types) expect(typeof rawForType(t, 10)).toBe('string');
  });
});
