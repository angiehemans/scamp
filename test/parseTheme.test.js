import { describe, it, expect } from 'vitest';
import { deriveThemeTokens, parseThemeCss, parseThemeFile, serializeThemeFile, themeDefFromClass, themeDefsFromParsed, } from '@lib/parseTheme';
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
        expect(result[0].name).toBe('--shadow-color');
        expect(result[0].value).toBe('rgba(0, 0, 0, 0.1)');
    });
});
describe('parseThemeFile', () => {
    it('returns empty tokens + urls for empty input', () => {
        expect(parseThemeFile('')).toEqual({
            tokens: [],
            themes: [],
            fontImportUrls: [],
        });
    });
    it('extracts a single @import url()', () => {
        const css = `@import url("https://fonts.googleapis.com/css2?family=Inter");
    :root { --a: 1; }`;
        expect(parseThemeFile(css)).toEqual({
            tokens: [{ name: '--a', value: '1' }],
            themes: [],
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
            themes: [],
            fontImportUrls: [],
        });
    });
    it('extracts --font-sans from the default scaffolded theme.css', async () => {
        const { DEFAULT_THEME_CSS, DEFAULT_BODY_FONT_FAMILY } = await import('../src/shared/agentMd');
        const result = parseThemeFile(DEFAULT_THEME_CSS);
        const fontSans = result.tokens.find((t) => t.name === '--font-sans');
        expect(fontSans).toBeDefined();
        expect(fontSans?.value).toBe(DEFAULT_BODY_FONT_FAMILY);
    });
    it('skips non-:root rules (e.g. body { font-family: var(--font-sans) })', () => {
        // Only `:root` declarations get pulled into tokens. Body / element
        // rules round-trip on disk but aren't surfaced in the panel.
        const css = `:root { --font-sans: system-ui; }
body { font-family: var(--font-sans); }`;
        const result = parseThemeFile(css);
        expect(result.tokens).toEqual([{ name: '--font-sans', value: 'system-ui' }]);
    });
    it('tolerates comments between imports and :root', () => {
        const css = `/* managed imports */
    @import url("https://fonts.googleapis.com/css2?family=Inter");

    :root {
      --color: red;
    }`;
        expect(parseThemeFile(css)).toEqual({
            tokens: [{ name: '--color', value: 'red' }],
            themes: [],
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
        expect(output).toContain('@import url("https://fonts.googleapis.com/css2?family=Inter");');
        expect(output.indexOf('@import')).toBeLessThan(output.indexOf(':root'));
    });
    it('round-trips through parseThemeFile', () => {
        const input = {
            tokens: [
                { name: '--blue', value: '#00f' },
                { name: '--red', value: '#f00' },
            ],
            themes: [],
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
describe('serializeThemeFile — preserving existing CSS', () => {
    const existing = `:root {
  --color-primary: #3b82f6;
  --color-muted: #888888;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
}
`;
    it('keeps hand-written rules outside :root untouched', () => {
        const output = serializeThemeFile({
            tokens: [{ name: '--color-primary', value: '#3b82f6' }],
            fontImportUrls: [],
        }, existing);
        expect(output).toContain('box-sizing: border-box;');
        expect(output).toContain('font-family: var(--font-sans);');
        expect(output).toContain('*::before,');
    });
    it('updates a changed token value in place', () => {
        const output = serializeThemeFile({
            tokens: [
                { name: '--color-primary', value: '#ff0000' },
                { name: '--color-muted', value: '#888888' },
            ],
            fontImportUrls: [],
        }, existing);
        expect(output).toContain('--color-primary: #ff0000;');
        expect(output).not.toContain('#3b82f6');
    });
    it('adds new tokens and drops deleted ones from :root', () => {
        const output = serializeThemeFile({
            tokens: [
                { name: '--color-primary', value: '#3b82f6' },
                { name: '--color-brand-500', value: '#2563eb' },
            ],
            fontImportUrls: [],
        }, existing);
        expect(output).toContain('--color-brand-500: #2563eb;');
        expect(output).not.toContain('--color-muted');
        // Non-token CSS is still intact.
        expect(output).toContain('box-sizing: border-box;');
    });
    it('round-trips the token set through parseThemeFile after an in-place edit', () => {
        const next = {
            tokens: [
                { name: '--color-primary', value: '#3b82f6' },
                { name: '--color-accent', value: 'var(--color-primary)' },
            ],
            fontImportUrls: [],
        };
        const parsed = parseThemeFile(serializeThemeFile(next, existing));
        expect(parsed.tokens).toEqual(next.tokens);
    });
    it('reconciles imports without disturbing other CSS', () => {
        const output = serializeThemeFile({
            tokens: [{ name: '--color-primary', value: '#3b82f6' }],
            fontImportUrls: ['https://fonts.googleapis.com/css2?family=Inter'],
        }, existing);
        expect(output).toContain('@import url("https://fonts.googleapis.com/css2?family=Inter");');
        expect(output.indexOf('@import')).toBeLessThan(output.indexOf(':root'));
        expect(output).toContain('box-sizing: border-box;');
    });
    it('removes a stale import when it is no longer in the list', () => {
        const withImport = `@import url("https://fonts.googleapis.com/css2?family=Inter");

:root {
  --color-primary: #3b82f6;
}
`;
        const output = serializeThemeFile({
            tokens: [{ name: '--color-primary', value: '#3b82f6' }],
            fontImportUrls: [],
        }, withImport);
        expect(output).not.toContain('@import');
    });
    it('does not stack duplicate managed-import comments across writes', () => {
        const first = serializeThemeFile({
            tokens: [{ name: '--color-primary', value: '#3b82f6' }],
            fontImportUrls: ['https://fonts.googleapis.com/css2?family=Inter'],
        }, existing);
        const second = serializeThemeFile({
            tokens: [{ name: '--color-primary', value: '#3b82f6' }],
            fontImportUrls: ['https://fonts.googleapis.com/css2?family=Roboto'],
        }, first);
        const commentCount = second.split('scamp: font imports').length - 1;
        expect(commentCount).toBe(1);
        expect(second).toContain('family=Roboto');
        expect(second).not.toContain('family=Inter');
    });
    it('falls back to a from-scratch write when existing CSS is blank', () => {
        const output = serializeThemeFile({ tokens: [{ name: '--a', value: '1' }], fontImportUrls: [] }, '   ');
        expect(output).toContain(':root {');
        expect(output).toContain('--a: 1;');
    });
    it('falls back to a from-scratch write when existing CSS will not parse', () => {
        const output = serializeThemeFile({ tokens: [{ name: '--a', value: '1' }], fontImportUrls: [] }, ':root { --a: ');
        // A valid file is still produced rather than throwing.
        expect(parseThemeFile(output).tokens).toEqual([{ name: '--a', value: '1' }]);
    });
    it('creates a :root block when the existing CSS has none', () => {
        const output = serializeThemeFile({ tokens: [{ name: '--a', value: '1' }], fontImportUrls: [] }, 'body {\n  margin: 0;\n}\n');
        expect(output).toContain('margin: 0;');
        expect(output).toContain(':root {');
        expect(output).toContain('--a: 1;');
    });
    it('keeps managed section comments attached to their tokens after an edit', () => {
        // Regression: the previous strip-and-re-append approach left every section
        // comment orphaned at the top of :root with all values dumped beneath.
        const sectioned = `:root {
  /* Primitives — brand */
  --color-brand-500: #3b82f6;
  --color-brand-700: #1d4ed8;

  /* Primitives — neutral */
  --color-neutral-500: #64748b;

  /* Semantic */
  --color-primary: var(--color-brand-500);
}
`;
        const output = serializeThemeFile({
            tokens: [
                { name: '--color-brand-500', value: '#2563eb' }, // changed
                { name: '--color-brand-700', value: '#1d4ed8' },
                { name: '--color-neutral-500', value: '#64748b' },
                { name: '--color-primary', value: 'var(--color-brand-500)' },
            ],
            fontImportUrls: [],
        }, sectioned);
        // The edit applied…
        expect(output).toContain('--color-brand-500: #2563eb;');
        // …and each section's tokens still sit under their own comment, in order:
        // brand token before the neutral comment, neutral token before Semantic, etc.
        const at = (needle) => output.indexOf(needle);
        expect(at('/* Primitives — brand */')).toBeLessThan(at('--color-brand-500'));
        expect(at('--color-brand-700')).toBeLessThan(at('/* Primitives — neutral */'));
        expect(at('/* Primitives — neutral */')).toBeLessThan(at('--color-neutral-500'));
        expect(at('--color-neutral-500')).toBeLessThan(at('/* Semantic */'));
        expect(at('/* Semantic */')).toBeLessThan(at('--color-primary'));
    });
});
describe('parseThemeFile — theme override blocks', () => {
    const css = `:root {
  --color-brand-900: #1e3a8a;
  --color-neutral-50: #f8fafc;
  --color-background: var(--color-neutral-50);
  --color-text: #111111;
}

.dark {
  --color-background: #1e3a8a;
  --color-text: #f8fafc;
}

.theme-high-contrast {
  --color-background: #000000;
  --color-text: #ffffff;
}
`;
    it('parses .dark and .theme-* blocks as theme overrides, in source order', () => {
        const { themes } = parseThemeFile(css);
        expect(themes?.map((t) => t.cssClass)).toEqual([
            'dark',
            'theme-high-contrast',
        ]);
        expect(themes?.[0]?.tokens).toEqual([
            { name: '--color-background', value: '#1e3a8a' },
            { name: '--color-text', value: '#f8fafc' },
        ]);
    });
    it('keeps :root tokens separate from theme overrides', () => {
        const { tokens } = parseThemeFile(css);
        expect(tokens.map((t) => t.name)).toEqual([
            '--color-brand-900',
            '--color-neutral-50',
            '--color-background',
            '--color-text',
        ]);
    });
    it('ignores non-theme class blocks', () => {
        const { themes } = parseThemeFile(`:root { --a: 1; }\n.button { color: red; }\n`);
        expect(themes).toEqual([]);
    });
});
describe('themeDefFromClass / themeDefsFromParsed', () => {
    it('maps the dark class to the built-in Dark theme', () => {
        expect(themeDefFromClass('dark')).toEqual({
            id: 'dark',
            label: 'Dark',
            cssClass: 'dark',
        });
    });
    it('title-cases a custom theme slug into a label', () => {
        expect(themeDefFromClass('theme-high-contrast')).toEqual({
            id: 'high-contrast',
            label: 'High Contrast',
            cssClass: 'theme-high-contrast',
        });
    });
    it('always lists Light first, then each override block', () => {
        const parsed = parseThemeFile(`:root { --a: 1; }\n.dark { --a: 2; }\n.theme-brand-a { --a: 3; }\n`);
        expect(themeDefsFromParsed(parsed)).toEqual([
            { id: 'light', label: 'Light', cssClass: '' },
            { id: 'dark', label: 'Dark', cssClass: 'dark' },
            { id: 'brand-a', label: 'Brand A', cssClass: 'theme-brand-a' },
        ]);
    });
});
describe('deriveThemeTokens', () => {
    const base = [
        { name: '--color-neutral-50', value: '#f8fafc' },
        { name: '--color-background', value: 'var(--color-neutral-50)' },
        { name: '--color-text', value: '#111111' },
    ];
    it('returns the base list unchanged when there are no overrides', () => {
        expect(deriveThemeTokens(base, [])).toEqual(base);
    });
    it('overrides matching semantic tokens by name, leaving primitives intact', () => {
        const result = deriveThemeTokens(base, [
            { name: '--color-background', value: '#1e3a8a' },
            { name: '--color-text', value: '#f8fafc' },
        ]);
        expect(result).toEqual([
            { name: '--color-neutral-50', value: '#f8fafc' },
            { name: '--color-background', value: '#1e3a8a' },
            { name: '--color-text', value: '#f8fafc' },
        ]);
    });
    it('appends an override token that is absent from the base', () => {
        const result = deriveThemeTokens(base, [
            { name: '--color-accent', value: '#ff0000' },
        ]);
        expect(result[result.length - 1]).toEqual({
            name: '--color-accent',
            value: '#ff0000',
        });
    });
});
describe('serializeThemeFile — theme blocks', () => {
    const model = {
        tokens: [
            { name: '--color-neutral-50', value: '#f8fafc' },
            { name: '--color-background', value: 'var(--color-neutral-50)' },
        ],
        themes: [
            {
                cssClass: 'dark',
                tokens: [{ name: '--color-background', value: '#1e3a8a' }],
            },
        ],
        fontImportUrls: [],
    };
    it('emits a .dark block after :root from scratch', () => {
        const output = serializeThemeFile(model);
        expect(output).toContain(':root {');
        expect(output).toContain('.dark {');
        expect(output.indexOf(':root')).toBeLessThan(output.indexOf('.dark'));
        expect(output).toContain('--color-background: #1e3a8a;');
    });
    it('round-trips themes: parse(serialize(model)) reproduces the blocks', () => {
        const parsed = parseThemeFile(serializeThemeFile(model));
        expect(parsed.tokens).toEqual(model.tokens);
        expect(parsed.themes).toEqual(model.themes);
    });
    it('upserts a theme block in existing CSS while preserving other rules', () => {
        const existing = `:root {
  --color-background: var(--color-neutral-50);
}

.dark {
  --color-background: #000000;
}

body {
  margin: 0;
}
`;
        const output = serializeThemeFile(model, existing);
        // The dark override is rewritten to the model value...
        expect(output).toContain('--color-background: #1e3a8a;');
        expect(output).not.toContain('#000000');
        // ...and hand-written CSS survives.
        expect(output).toContain('margin: 0;');
    });
    it('removes a managed theme block that the model no longer defines', () => {
        const existing = `:root {
  --color-background: #fff;
}

.dark {
  --color-background: #000;
}
`;
        const output = serializeThemeFile({
            tokens: [{ name: '--color-background', value: '#fff' }],
            themes: [],
            fontImportUrls: [],
        }, existing);
        expect(output).not.toContain('.dark');
    });
});
describe('serializeThemeFile — grouped :root sections', () => {
    it('groups tokens under section comments by role', () => {
        const output = serializeThemeFile({
            tokens: [
                { name: '--color-brand-50', value: '#eff6ff' },
                { name: '--color-brand-900', value: '#1e3a8a' },
                { name: '--color-primary', value: 'var(--color-brand-500)' },
                { name: '--font-sans', value: 'system-ui' },
            ],
            fontImportUrls: [],
        }, 
        // A non-empty existing file routes through the grouped merge path.
        ':root {\n}\n');
        expect(output).toContain('/* Primitives — brand */');
        expect(output).toContain('/* Semantic */');
        expect(output).toContain('/* Typography */');
        // Each comment precedes the tokens it labels, in role order.
        expect(output.indexOf('/* Primitives — brand */')).toBeLessThan(output.indexOf('--color-brand-50'));
        expect(output.indexOf('--color-brand-900')).toBeLessThan(output.indexOf('/* Semantic */'));
        expect(output.indexOf('/* Semantic */')).toBeLessThan(output.indexOf('--color-primary'));
        expect(output.indexOf('/* Typography */')).toBeLessThan(output.indexOf('--font-sans'));
    });
    it('heals a file whose section comments were orphaned from their tokens', () => {
        // An older writer clustered every comment at the top and dumped all
        // tokens under the last one (the reported bug).
        const broken = `:root {
  /* Primitives — brand */

  /* Semantic */

  /* Typography */
  --color-brand-50: #eff6ff;
  --color-primary: var(--color-brand-500);
  --font-sans: system-ui;
}
`;
        const output = serializeThemeFile({
            tokens: [
                { name: '--color-brand-50', value: '#eff6ff' },
                { name: '--color-primary', value: 'var(--color-brand-500)' },
                { name: '--font-sans', value: 'system-ui' },
            ],
            fontImportUrls: [],
        }, broken);
        // The brand token now sits under its own comment, before Semantic.
        expect(output.indexOf('/* Primitives — brand */')).toBeLessThan(output.indexOf('--color-brand-50'));
        expect(output.indexOf('--color-brand-50')).toBeLessThan(output.indexOf('/* Semantic */'));
        // No empty section: a comment is never immediately followed by another.
        expect(output).not.toMatch(/\/\* Primitives — brand \*\/\s*\/\* Semantic \*\//);
    });
});
describe('serializeThemeFile — design-role sections', () => {
    it('groups spacing / radius / shadow tokens under their own comments', () => {
        const output = serializeThemeFile({
            tokens: [
                { name: '--color-primary', value: '#3b82f6' },
                { name: '--space-4', value: '16px' },
                { name: '--radius-md', value: '8px' },
                { name: '--shadow-sm', value: '0 1px 2px rgba(0, 0, 0, 0.05)' },
            ],
            fontImportUrls: [],
        }, ':root {\n}\n');
        expect(output).toContain('/* Spacing */');
        expect(output).toContain('/* Radius */');
        expect(output).toContain('/* Shadows */');
        expect(output.indexOf('/* Spacing */')).toBeLessThan(output.indexOf('--space-4'));
        expect(output.indexOf('--space-4')).toBeLessThan(output.indexOf('/* Radius */'));
        // Round-trips: shadow value with commas survives.
        const parsed = parseThemeFile(output);
        expect(parsed.tokens).toContainEqual({
            name: '--shadow-sm',
            value: '0 1px 2px rgba(0, 0, 0, 0.05)',
        });
    });
});
