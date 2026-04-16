import { describe, it, expect } from 'vitest';
import {
  formatFontValue,
  inferFallback,
  quoteFamilyName,
} from '@renderer/lib/fontFallback';

describe('inferFallback', () => {
  it('picks monospace for mono-family names', () => {
    expect(inferFallback('Fira Code')).toBe('monospace');
    expect(inferFallback('IBM Plex Mono')).toBe('monospace');
    expect(inferFallback('Courier New')).toBe('monospace');
    expect(inferFallback('Menlo')).toBe('monospace');
    expect(inferFallback('Consolas')).toBe('monospace');
  });

  it('picks serif for serif-family names', () => {
    expect(inferFallback('Times New Roman')).toBe('serif');
    expect(inferFallback('Georgia')).toBe('serif');
    expect(inferFallback('Playfair Display')).toBe('serif');
    expect(inferFallback('Merriweather')).toBe('serif');
    expect(inferFallback('Source Serif Pro')).toBe('serif');
  });

  it('picks cursive for script/hand-family names', () => {
    expect(inferFallback('Dancing Script')).toBe('cursive');
    expect(inferFallback('Pacifico')).toBe('cursive');
    expect(inferFallback('Caveat')).toBe('cursive');
  });

  it('defaults unknown names to sans-serif', () => {
    expect(inferFallback('Inter')).toBe('sans-serif');
    expect(inferFallback('Helvetica Neue')).toBe('sans-serif');
    expect(inferFallback('Random Made-Up Font')).toBe('sans-serif');
  });

  it('is case-insensitive', () => {
    expect(inferFallback('FIRA CODE')).toBe('monospace');
    expect(inferFallback('times')).toBe('serif');
  });
});

describe('quoteFamilyName', () => {
  it('leaves single-word identifiers unquoted', () => {
    expect(quoteFamilyName('Arial')).toBe('Arial');
    expect(quoteFamilyName('Helvetica-Bold')).toBe('Helvetica-Bold');
  });

  it('quotes names containing whitespace', () => {
    expect(quoteFamilyName('Helvetica Neue')).toBe('"Helvetica Neue"');
    expect(quoteFamilyName('Times New Roman')).toBe('"Times New Roman"');
  });

  it('quotes names starting with a digit', () => {
    expect(quoteFamilyName('1979')).toBe('"1979"');
  });

  it('quotes names with punctuation', () => {
    expect(quoteFamilyName('Source Code Pro, 500')).toBe(
      '"Source Code Pro, 500"'
    );
  });

  it('preserves already-quoted input', () => {
    expect(quoteFamilyName('"Helvetica Neue"')).toBe('"Helvetica Neue"');
    expect(quoteFamilyName("'Helvetica Neue'")).toBe("'Helvetica Neue'");
  });

  it('returns empty string unchanged', () => {
    expect(quoteFamilyName('')).toBe('');
    expect(quoteFamilyName('   ')).toBe('');
  });
});

describe('formatFontValue', () => {
  it('combines quoted family + inferred fallback', () => {
    expect(formatFontValue('Helvetica Neue')).toBe(
      '"Helvetica Neue", sans-serif'
    );
    expect(formatFontValue('Fira Code')).toBe('"Fira Code", monospace');
    expect(formatFontValue('Playfair Display')).toBe(
      '"Playfair Display", serif'
    );
  });

  it('leaves single-word unquoted', () => {
    expect(formatFontValue('Arial')).toBe('Arial, sans-serif');
    expect(formatFontValue('Georgia')).toBe('Georgia, serif');
  });

  it('returns empty string for blank input', () => {
    expect(formatFontValue('')).toBe('');
    expect(formatFontValue('   ')).toBe('');
  });

  it('trims surrounding whitespace before formatting', () => {
    expect(formatFontValue('  Inter  ')).toBe('Inter, sans-serif');
  });
});
