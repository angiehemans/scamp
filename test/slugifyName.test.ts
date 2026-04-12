import { describe, it, expect } from 'vitest';
import { slugifyName } from '@lib/element';

describe('slugifyName', () => {
  it('lowercases and replaces spaces with underscores', () => {
    expect(slugifyName('Hero Card')).toBe('hero_card');
  });

  it('trims whitespace', () => {
    expect(slugifyName('  My Button ')).toBe('my_button');
  });

  it('strips non-alphanumeric-or-underscore characters', () => {
    expect(slugifyName('Nav/Header')).toBe('navheader');
  });

  it('collapses multiple underscores', () => {
    expect(slugifyName('hello___world')).toBe('hello_world');
  });

  it('strips leading and trailing underscores', () => {
    expect(slugifyName('_test_')).toBe('test');
  });

  it('returns empty string for all-symbol input', () => {
    expect(slugifyName('!!!')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(slugifyName('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(slugifyName('   ')).toBe('');
  });

  it('prefixes with underscore when result starts with a digit', () => {
    expect(slugifyName('123test')).toBe('_123test');
  });

  it('handles single word', () => {
    expect(slugifyName('Sidebar')).toBe('sidebar');
  });

  it('handles already-slugified input', () => {
    expect(slugifyName('hero_card')).toBe('hero_card');
  });
});
