import { describe, it, expect } from 'vitest';
import { parseThemeCss } from '@lib/parseTheme';

describe('parseThemeCss', () => {
  it('extracts custom properties from a :root rule', () => {
    const css = `:root {
      --color-primary: #3b82f6;
      --color-text: #111111;
    }`;
    expect(parseThemeCss(css)).toEqual([
      { name: '--color-primary', value: '#3b82f6' },
      { name: '--color-text', value: '#111111' },
    ]);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseThemeCss('')).toEqual([]);
  });

  it('returns an empty array for whitespace-only input', () => {
    expect(parseThemeCss('   \n  ')).toEqual([]);
  });

  it('ignores non-:root rules', () => {
    const css = `.button { --local: red; }
    :root { --global: blue; }`;
    expect(parseThemeCss(css)).toEqual([
      { name: '--global', value: 'blue' },
    ]);
  });

  it('ignores non-custom-property declarations in :root', () => {
    const css = `:root {
      color: red;
      --token: #fff;
      font-size: 16px;
    }`;
    expect(parseThemeCss(css)).toEqual([
      { name: '--token', value: '#fff' },
    ]);
  });

  it('takes the last value when a property is duplicated', () => {
    const css = `:root {
      --color: red;
      --color: blue;
    }`;
    expect(parseThemeCss(css)).toEqual([
      { name: '--color', value: 'blue' },
    ]);
  });

  it('returns an empty array for malformed CSS', () => {
    expect(parseThemeCss('this is { not valid {{ css')).toEqual([]);
  });

  it('handles multiple :root blocks by merging them', () => {
    const css = `:root { --a: 1; }
    :root { --b: 2; }`;
    expect(parseThemeCss(css)).toEqual([
      { name: '--a', value: '1' },
      { name: '--b', value: '2' },
    ]);
  });

  it('handles rgba and complex values', () => {
    const css = `:root {
      --shadow-color: rgba(0, 0, 0, 0.1);
      --gradient: linear-gradient(90deg, #000, #fff);
    }`;
    const result = parseThemeCss(css);
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe('--shadow-color');
    expect(result[0]!.value).toBe('rgba(0, 0, 0, 0.1)');
  });
});
