import { describe, it, expect } from 'vitest';
import { decideLayoutMigration } from '../src/shared/layoutMigration';
import {
  DEFAULT_BODY_FONT_FAMILY,
  DEFAULT_THEME_CSS,
  defaultLayoutTsx,
  LEGACY_LAYOUT_TEMPLATES,
} from '../src/shared/agentMd';

describe('decideLayoutMigration', () => {
  it('returns noop when the file already matches the latest template', () => {
    const projectName = 'my-project';
    const action = decideLayoutMigration(defaultLayoutTsx(projectName), projectName);
    expect(action).toEqual({ kind: 'noop' });
  });

  it('returns replace when the file matches a known legacy template', () => {
    const projectName = 'my-project';
    const legacy = LEGACY_LAYOUT_TEMPLATES(projectName)[0];
    expect(legacy).toBeDefined();
    const action = decideLayoutMigration(legacy!, projectName);
    expect(action.kind).toBe('replace');
    if (action.kind === 'replace') {
      expect(action.next).toBe(defaultLayoutTsx(projectName));
    }
  });

  it('returns warn when the file has been customised', () => {
    const projectName = 'my-project';
    const customised = `${defaultLayoutTsx(projectName)}\n// user-added comment\n`;
    const action = decideLayoutMigration(customised, projectName);
    expect(action.kind).toBe('warn');
    if (action.kind === 'warn') {
      expect(action.reason).toContain('body reset');
    }
  });

  it('returns warn when the file project-name embed differs (defensive against stale legacy match)', () => {
    // Legacy template embedded with a different project name → does
    // not match. We treat this as customised rather than risk
    // overwriting a layout someone copied from another project.
    const legacyForOther = LEGACY_LAYOUT_TEMPLATES('other-project')[0]!;
    const action = decideLayoutMigration(legacyForOther, 'my-project');
    expect(action.kind).toBe('warn');
  });

  it('handles trailing-whitespace differences strictly (warn, not replace)', () => {
    const projectName = 'my-project';
    const legacy = LEGACY_LAYOUT_TEMPLATES(projectName)[0]!;
    const action = decideLayoutMigration(`${legacy} `, projectName);
    expect(action.kind).toBe('warn');
  });
});

describe('defaultLayoutTsx — body reset', () => {
  it("emits margin: 0 and minHeight: '100vh' on the <body>", () => {
    const out = defaultLayoutTsx('proj');
    expect(out).toContain(
      "<body style={{ margin: 0, minHeight: '100vh' }}>{children}</body>"
    );
  });

  it('embeds the project name in the metadata title', () => {
    const out = defaultLayoutTsx('Acme Pages');
    expect(out).toContain("title: 'Acme Pages',");
  });
});

describe('DEFAULT_THEME_CSS — font default', () => {
  it('declares a --font-sans token with the system font stack', () => {
    expect(DEFAULT_THEME_CSS).toContain(`--font-sans: ${DEFAULT_BODY_FONT_FAMILY}`);
  });

  it('applies the default font to body via the token', () => {
    expect(DEFAULT_THEME_CSS).toContain('body {');
    expect(DEFAULT_THEME_CSS).toContain('font-family: var(--font-sans)');
  });

  it('keeps the original color palette tokens intact', () => {
    expect(DEFAULT_THEME_CSS).toContain('--color-primary:');
    expect(DEFAULT_THEME_CSS).toContain('--color-text:');
  });

  it('includes a universal box-sizing: border-box reset', () => {
    expect(DEFAULT_THEME_CSS).toContain('*::before');
    expect(DEFAULT_THEME_CSS).toContain('*::after');
    expect(DEFAULT_THEME_CSS).toContain('box-sizing: border-box');
  });
});
