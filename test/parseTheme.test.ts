import { describe, it, expect } from 'vitest';
import {
  parseThemeCss,
  parseThemeFile,
  serializeThemeFile,
} from '@lib/parseTheme';

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

describe('parseThemeFile', () => {
  it('returns empty tokens + urls for empty input', () => {
    expect(parseThemeFile('')).toEqual({ tokens: [], fontImportUrls: [] });
  });

  it('extracts a single @import url()', () => {
    const css = `@import url("https://fonts.googleapis.com/css2?family=Inter");
    :root { --a: 1; }`;
    expect(parseThemeFile(css)).toEqual({
      tokens: [{ name: '--a', value: '1' }],
      fontImportUrls: ['https://fonts.googleapis.com/css2?family=Inter'],
    });
  });

  it('extracts multiple imports preserving order', () => {
    const css = `@import url("https://fonts.googleapis.com/css2?family=Inter");
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display');
    :root { --a: 1; }`;
    const result = parseThemeFile(css);
    expect(result.fontImportUrls).toEqual([
      'https://fonts.googleapis.com/css2?family=Inter',
      'https://fonts.googleapis.com/css2?family=Playfair+Display',
    ]);
  });

  it('extracts bare-string @import forms', () => {
    const css = `@import "https://fonts.googleapis.com/css2?family=Inter";`;
    expect(parseThemeFile(css).fontImportUrls).toEqual([
      'https://fonts.googleapis.com/css2?family=Inter',
    ]);
  });

  it('dedupes duplicate imports', () => {
    const css = `@import url("https://fonts.googleapis.com/css2?family=Inter");
    @import url("https://fonts.googleapis.com/css2?family=Inter");`;
    expect(parseThemeFile(css).fontImportUrls).toEqual([
      'https://fonts.googleapis.com/css2?family=Inter',
    ]);
  });

  it('ignores :root rules that contain no imports', () => {
    const css = `:root { --a: 1; }`;
    expect(parseThemeFile(css)).toEqual({
      tokens: [{ name: '--a', value: '1' }],
      fontImportUrls: [],
    });
  });

  it('tolerates comments between imports and :root', () => {
    const css = `/* managed imports */
    @import url("https://fonts.googleapis.com/css2?family=Inter");

    :root {
      --color: red;
    }`;
    expect(parseThemeFile(css)).toEqual({
      tokens: [{ name: '--color', value: 'red' }],
      fontImportUrls: ['https://fonts.googleapis.com/css2?family=Inter'],
    });
  });
});

describe('serializeThemeFile', () => {
  it('emits imports above :root', () => {
    const output = serializeThemeFile({
      tokens: [{ name: '--a', value: '1' }],
      fontImportUrls: ['https://fonts.googleapis.com/css2?family=Inter'],
    });
    expect(output).toContain(
      '@import url("https://fonts.googleapis.com/css2?family=Inter");'
    );
    expect(output.indexOf('@import')).toBeLessThan(output.indexOf(':root'));
  });

  it('round-trips through parseThemeFile', () => {
    const input = {
      tokens: [
        { name: '--blue', value: '#00f' },
        { name: '--red', value: '#f00' },
      ],
      fontImportUrls: [
        'https://fonts.googleapis.com/css2?family=Inter',
        'https://fonts.googleapis.com/css2?family=Playfair+Display',
      ],
    };
    const parsed = parseThemeFile(serializeThemeFile(input));
    expect(parsed).toEqual(input);
  });

  it('emits an empty :root when there are no tokens', () => {
    const output = serializeThemeFile({
      tokens: [],
      fontImportUrls: ['https://fonts.googleapis.com/css2?family=Inter'],
    });
    expect(output).toContain(':root {\n}');
  });

  it('emits only :root when there are no imports', () => {
    const output = serializeThemeFile({
      tokens: [{ name: '--a', value: '1' }],
      fontImportUrls: [],
    });
    expect(output).not.toContain('@import');
    expect(output).toContain(':root {');
  });
});
