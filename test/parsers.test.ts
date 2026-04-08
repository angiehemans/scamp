import { describe, it, expect } from 'vitest';
import {
  parsePx,
  parseBorderShorthand,
  parsePaddingShorthand,
} from '@lib/parsers';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';

describe('parsePx', () => {
  it('parses a px value', () => {
    expect(parsePx('16px')).toBe(16);
  });

  it('parses a bare number', () => {
    expect(parsePx('24')).toBe(24);
  });

  it('parses a decimal and rounds to nearest integer', () => {
    expect(parsePx('16.6px')).toBe(17);
  });

  it('parses a negative value', () => {
    expect(parsePx('-8px')).toBe(-8);
  });

  it('returns 0 for an empty string', () => {
    expect(parsePx('')).toBe(0);
  });

  it('returns 0 for whitespace', () => {
    expect(parsePx('   ')).toBe(0);
  });

  it('returns 0 for unparseable input', () => {
    expect(parsePx('auto')).toBe(0);
  });

  it('returns 0 for unsupported units', () => {
    expect(parsePx('2em')).toBe(0);
  });
});

describe('parseBorderShorthand', () => {
  it('parses a full shorthand: 1px solid #ccc', () => {
    expect(parseBorderShorthand('1px solid #ccc')).toEqual({
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: '#ccc',
    });
  });

  it('parses dashed style', () => {
    expect(parseBorderShorthand('2px dashed #000000')).toEqual({
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: '#000000',
    });
  });

  it('parses out-of-order tokens: solid 1px red', () => {
    expect(parseBorderShorthand('solid 1px red')).toEqual({
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: 'red',
    });
  });

  it('handles rgb() colors with internal whitespace', () => {
    expect(parseBorderShorthand('1px solid rgb(255, 0, 0)')).toEqual({
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: 'rgb(255, 0, 0)',
    });
  });

  it('treats `none` as zero-width', () => {
    expect(parseBorderShorthand('none')).toEqual({
      borderWidth: 0,
      borderStyle: 'none',
      borderColor: DEFAULT_RECT_STYLES.borderColor,
    });
  });

  it('treats `0` as zero-width with default style', () => {
    expect(parseBorderShorthand('0')).toEqual({
      borderWidth: 0,
      borderStyle: 'none',
      borderColor: DEFAULT_RECT_STYLES.borderColor,
    });
  });

  it('returns defaults for an empty string', () => {
    expect(parseBorderShorthand('')).toEqual({
      borderWidth: DEFAULT_RECT_STYLES.borderWidth,
      borderStyle: DEFAULT_RECT_STYLES.borderStyle,
      borderColor: DEFAULT_RECT_STYLES.borderColor,
    });
  });

  it('falls back to defaults for missing tokens', () => {
    expect(parseBorderShorthand('3px')).toEqual({
      borderWidth: 3,
      borderStyle: DEFAULT_RECT_STYLES.borderStyle,
      borderColor: DEFAULT_RECT_STYLES.borderColor,
    });
  });

  it('collapses unsupported border styles to solid', () => {
    // `double` is valid CSS but not in the scamp BorderStyle union; we
    // still draw something rather than nothing.
    expect(parseBorderShorthand('1px double #000')).toEqual({
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: '#000',
    });
  });
});

describe('parsePaddingShorthand', () => {
  it('parses one value: padding: 16px', () => {
    expect(parsePaddingShorthand('16px')).toEqual([16, 16, 16, 16]);
  });

  it('parses two values: vertical / horizontal', () => {
    expect(parsePaddingShorthand('12px 24px')).toEqual([12, 24, 12, 24]);
  });

  it('parses three values: top / horizontal / bottom', () => {
    expect(parsePaddingShorthand('4px 8px 16px')).toEqual([4, 8, 16, 8]);
  });

  it('parses four values: top right bottom left', () => {
    expect(parsePaddingShorthand('1px 2px 3px 4px')).toEqual([1, 2, 3, 4]);
  });

  it('handles bare numbers', () => {
    expect(parsePaddingShorthand('10 20')).toEqual([10, 20, 10, 20]);
  });

  it('returns zeros for an empty string', () => {
    expect(parsePaddingShorthand('')).toEqual([0, 0, 0, 0]);
  });

  it('returns zeros for whitespace-only input', () => {
    expect(parsePaddingShorthand('   ')).toEqual([0, 0, 0, 0]);
  });

  it('treats unparseable tokens as 0', () => {
    expect(parsePaddingShorthand('auto auto')).toEqual([0, 0, 0, 0]);
  });
});
