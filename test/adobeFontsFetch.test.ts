import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractFontFamilies,
  fetchAdobeKitFamilies,
} from '@lib/adobeFontsFetch';

describe('extractFontFamilies', () => {
  it('pulls one family per @font-face block', () => {
    const css = `@font-face {
  font-family: "source-sans-pro";
  src: url("…") format("woff2");
  font-weight: 400;
}
@font-face {
  font-family: "playfair-display";
  src: url("…") format("woff2");
}`;
    expect(extractFontFamilies(css)).toEqual([
      'playfair-display',
      'source-sans-pro',
    ]);
  });

  it('dedupes families repeated across weight variants', () => {
    const css = `@font-face { font-family: "inter"; font-weight: 400; src: url(""); }
@font-face { font-family: "inter"; font-weight: 700; src: url(""); }`;
    expect(extractFontFamilies(css)).toEqual(['inter']);
  });

  it('accepts single-quoted family names', () => {
    const css = `@font-face { font-family: 'roboto'; src: url(""); }`;
    expect(extractFontFamilies(css)).toEqual(['roboto']);
  });

  it('returns [] for CSS with no @font-face declarations', () => {
    expect(extractFontFamilies('.foo { color: red; }')).toEqual([]);
  });

  it('sorts families alphabetically', () => {
    const css = `@font-face { font-family: "zeta"; src: url(""); }
@font-face { font-family: "alpha"; src: url(""); }
@font-face { font-family: "mu"; src: url(""); }`;
    expect(extractFontFamilies(css)).toEqual(['alpha', 'mu', 'zeta']);
  });
});

describe('fetchAdobeKitFamilies', () => {
  const URL = 'https://use.typekit.net/abc1def.css';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns families from a 200 response', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        '@font-face { font-family: "source-sans-pro"; src: url(""); }\n' +
        '@font-face { font-family: "playfair-display"; src: url(""); }',
    });
    const result = await fetchAdobeKitFamilies(URL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.families).toEqual([
        'playfair-display',
        'source-sans-pro',
      ]);
    }
  });

  it('returns a typed error on non-2xx', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => '',
    });
    const result = await fetchAdobeKitFamilies(URL);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('404');
  });

  it('returns a typed error on network failure', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new TypeError('Failed to fetch')
    );
    const result = await fetchAdobeKitFamilies(URL);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Failed to fetch');
  });

  it('returns a typed error when the response has no @font-face blocks', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '/* empty kit */',
    });
    const result = await fetchAdobeKitFamilies(URL);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('@font-face');
  });
});
