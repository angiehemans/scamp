import postcss from 'postcss';
import type { ThemeDef, ThemeToken } from '@shared/types';

/**
 * A per-theme override block — the semantic tokens declared inside a
 * `.dark` / `.theme-<slug>` CSS class. `cssClass` is the selector class
 * without the leading dot (`dark`, `theme-high-contrast`).
 */
export type ThemeBlock = {
  cssClass: string;
  tokens: ThemeToken[];
};

export type ParsedTheme = {
  tokens: ThemeToken[];
  /**
   * Per-theme override blocks (`.dark` / `.theme-*`). Optional so
   * existing single-theme callers can keep passing `{ tokens,
   * fontImportUrls }`. Order is source order.
   */
  themes?: ThemeBlock[];
  /**
   * Ordered `url(...)` values from top-level `@import` at-rules. We
   * care about these because projects track Google Fonts embeds here;
   * callers use them to inject `<link rel="stylesheet">` tags on the
   * canvas preview and to merge Google families into the font picker.
   */
  fontImportUrls: string[];
};

/** Class selector for a theme override block. `theme-<slug>` for customs. */
const THEME_CLASS_RE = /^\.(dark|theme-[\w-]+)$/;

/**
 * Derive a `ThemeDef` from a theme block's CSS class. `dark` → the
 * built-in Dark theme; `theme-<slug>` → a custom theme whose id is the
 * slug and whose label is the slug title-cased.
 */
export const themeDefFromClass = (cssClass: string): ThemeDef => {
  if (cssClass === 'dark') return { id: 'dark', label: 'Dark', cssClass };
  const slug = cssClass.startsWith('theme-')
    ? cssClass.slice('theme-'.length)
    : cssClass;
  const label = slug
    .split('-')
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return { id: slug, label: label || slug, cssClass };
};

/** The light theme is always present, backed by the `:root` block. */
export const LIGHT_THEME: ThemeDef = { id: 'light', label: 'Light', cssClass: '' };

/**
 * The ordered theme list for a parsed file: Light (always) followed by
 * each override block in source order.
 */
export const themeDefsFromParsed = (parsed: ParsedTheme): ThemeDef[] => [
  LIGHT_THEME,
  ...(parsed.themes ?? []).map((b) => themeDefFromClass(b.cssClass)),
];

/**
 * Flatten to the token list for one theme: the base `:root` tokens with
 * the theme's semantic overrides applied by name. Primitives and
 * typography (which never appear in override blocks) pass through
 * unchanged; an override naming a token absent from the base is appended.
 */
export const deriveThemeTokens = (
  base: ReadonlyArray<ThemeToken>,
  overrides: ReadonlyArray<ThemeToken>
): ThemeToken[] => {
  if (overrides.length === 0) return [...base];
  const overrideMap = new Map(overrides.map((t) => [t.name, t.value]));
  const baseNames = new Set(base.map((t) => t.name));
  const merged = base.map((t) => {
    const o = overrideMap.get(t.name);
    return o !== undefined ? { name: t.name, value: o } : t;
  });
  const extra = overrides.filter((o) => !baseNames.has(o.name));
  return [...merged, ...extra];
};

const IMPORT_URL_RE = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)\s]+))\s*\)/;

/**
 * Pull the URL out of an `@import` at-rule's params. Supports the
 * `url("…")`, `url('…')`, `url(…)`, and bare-string (`"…"` / `'…'`)
 * forms CSS lets users write.
 */
const extractImportUrl = (params: string): string | null => {
  const trimmed = params.trim();
  if (trimmed.length === 0) return null;
  const m = trimmed.match(IMPORT_URL_RE);
  if (m) {
    return (m[1] ?? m[2] ?? m[3] ?? '').trim() || null;
  }
  // Bare-string form: `@import "foo.css";` / `@import 'foo.css';`.
  if (
    (trimmed.startsWith('"') && trimmed.slice(1).includes('"')) ||
    (trimmed.startsWith("'") && trimmed.slice(1).includes("'"))
  ) {
    const quote = trimmed[0];
    const end = trimmed.indexOf(quote as string, 1);
    if (end > 1) return trimmed.slice(1, end);
  }
  return null;
};

/** Collect the `--*` declarations from a rule into an ordered token list. */
const tokensFromRule = (rule: postcss.Rule): ThemeToken[] => {
  const map = new Map<string, string>();
  rule.walkDecls((decl) => {
    if (decl.prop.startsWith('--')) map.set(decl.prop, decl.value);
  });
  return [...map.entries()].map(([name, value]) => ({ name, value }));
};

/**
 * Parse a CSS file and extract all custom properties (`--*`) from
 * `:root` rule blocks, every `.dark` / `.theme-*` theme override block,
 * plus every top-level `@import` URL. Returns the `:root` tokens (last
 * declaration wins on duplicates, same as CSS cascade), the per-theme
 * override blocks in source order, and an ordered list of import URLs.
 *
 * Other rules and non-custom-property declarations are ignored.
 * Malformed CSS returns empty lists rather than throwing.
 */
export const parseThemeFile = (css: string): ParsedTheme => {
  if (typeof css !== 'string' || css.trim().length === 0) {
    return { tokens: [], themes: [], fontImportUrls: [] };
  }

  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return { tokens: [], themes: [], fontImportUrls: [] };
  }

  const tokenMap = new Map<string, string>();
  const urls: string[] = [];
  const themes: ThemeBlock[] = [];

  root.walkAtRules('import', (atRule) => {
    const url = extractImportUrl(atRule.params);
    if (url && !urls.includes(url)) urls.push(url);
  });

  root.walkRules((rule) => {
    const selector = rule.selector.trim();
    if (selector === ':root') {
      rule.walkDecls((decl) => {
        if (decl.prop.startsWith('--')) tokenMap.set(decl.prop, decl.value);
      });
      return;
    }
    const m = selector.match(THEME_CLASS_RE);
    if (m && m[1] !== undefined) {
      const cssClass = m[1];
      const tokens = tokensFromRule(rule);
      if (tokens.length === 0) return;
      const existing = themes.find((t) => t.cssClass === cssClass);
      if (existing) existing.tokens.push(...tokens);
      else themes.push({ cssClass, tokens });
    }
  });

  return {
    tokens: [...tokenMap.entries()].map(([name, value]) => ({ name, value })),
    themes,
    fontImportUrls: urls,
  };
};

/**
 * Backward-compatible token extractor. Prefer `parseThemeFile` when
 * you also need the import URLs.
 */
export const parseThemeCss = (css: string): ThemeToken[] => {
  return parseThemeFile(css).tokens;
};

const MANAGED_IMPORTS_COMMENT =
  '/* scamp: font imports — managed by Project Settings → Fonts */';
const MANAGED_IMPORTS_TEXT =
  'scamp: font imports — managed by Project Settings → Fonts';

/**
 * Update an existing theme.css in place: reconcile the `:root` custom
 * properties and top-level `@import`s to match `parsed`, while leaving
 * every other rule, comment, and hand-written declaration untouched.
 *
 * The panel can reorder/rename tokens freely, so we don't try to match
 * old declarations to new ones — we strip all `--*` decls from `:root`
 * and rewrite the canonical set. Non-custom decls and other rules
 * (resets, `body {}`, etc.) survive. Returns null if the CSS won't
 * parse so the caller can fall back to a from-scratch write.
 * see docs/plans/design-system-plan.md
 */
const mergeIntoExistingCss = (
  parsed: ParsedTheme,
  existingCss: string
): string | null => {
  let root: postcss.Root;
  try {
    root = postcss.parse(existingCss);
  } catch {
    return null;
  }

  // Imports: the parser round-trips ALL top-level @import URLs through
  // fontImportUrls, so reconcile = drop existing imports (and any stale
  // managed-imports comment) and re-add the current list at the top.
  root.walkAtRules('import', (r) => {
    r.remove();
  });
  root.walkComments((c) => {
    if (c.text.trim() === MANAGED_IMPORTS_TEXT) c.remove();
  });
  if (parsed.fontImportUrls.length > 0) {
    const importCss = `${MANAGED_IMPORTS_COMMENT}\n${parsed.fontImportUrls
      .map((u) => `@import url("${u}");`)
      .join('\n')}\n\n`;
    root.prepend(...postcss.parse(importCss).nodes);
  }

  // Tokens: strip every custom property from all :root blocks, then write
  // the canonical set into the first one (creating it if none exists).
  const roots: postcss.Rule[] = [];
  root.walkRules((rule) => {
    if (rule.selector.trim() === ':root') roots.push(rule);
  });
  for (const r of roots) {
    r.walkDecls((decl) => {
      if (decl.prop.startsWith('--')) decl.remove();
    });
  }
  let target = roots[0];
  if (!target) {
    target = postcss.rule({ selector: ':root' });
    target.raws.before = '\n\n';
    target.raws.between = ' ';
    root.append(target);
  }
  target.raws.after = '\n';
  target.raws.semicolon = true;
  for (const t of parsed.tokens) {
    const decl = postcss.decl({ prop: t.name, value: t.value });
    decl.raws.before = '\n  ';
    decl.raws.between = ': ';
    target.append(decl);
  }
  // Drop secondary :root blocks we just emptied so they don't linger.
  for (let i = roots.length - 1; i >= 1; i -= 1) {
    const r = roots[i];
    if (r && r.nodes.length === 0) r.remove();
  }

  // Theme blocks: reconcile `.dark` / `.theme-*` rules to match the model.
  // Strip their `--*` decls (keeping any hand-written non-custom CSS), then
  // rewrite each model theme's tokens; drop managed blocks the model dropped.
  const modelThemes = parsed.themes ?? [];
  const themeRules: postcss.Rule[] = [];
  root.walkRules((rule) => {
    if (THEME_CLASS_RE.test(rule.selector.trim())) themeRules.push(rule);
  });
  for (const r of themeRules) {
    r.walkDecls((decl) => {
      if (decl.prop.startsWith('--')) decl.remove();
    });
  }
  const modelClasses = new Set(modelThemes.map((t) => t.cssClass));
  for (const block of modelThemes) {
    const selector = `.${block.cssClass}`;
    let rule = themeRules.find((r) => r.selector.trim() === selector);
    if (!rule) {
      rule = postcss.rule({ selector });
      rule.raws.before = '\n\n';
      rule.raws.between = ' ';
      root.append(rule);
      themeRules.push(rule);
    }
    rule.raws.after = '\n';
    rule.raws.semicolon = true;
    for (const t of block.tokens) {
      const decl = postcss.decl({ prop: t.name, value: t.value });
      decl.raws.before = '\n  ';
      decl.raws.between = ': ';
      rule.append(decl);
    }
  }
  for (const r of themeRules) {
    const cls = r.selector.trim().replace(/^\./, '');
    if (!modelClasses.has(cls) && r.nodes.length === 0) r.remove();
  }

  return root.toString();
};

/**
 * Serialize tokens + font import URLs back to CSS.
 *
 * When `existingCss` is provided, tokens and imports are updated in
 * place and all other CSS (resets, `body {}`, comments) is preserved
 * (see `mergeIntoExistingCss`). Without it — or if that CSS won't parse
 * — this falls back to a full from-scratch write that emits the imports
 * above a single `:root` block.
 */
export const serializeThemeFile = (
  parsed: ParsedTheme,
  existingCss?: string
): string => {
  if (typeof existingCss === 'string' && existingCss.trim().length > 0) {
    const merged = mergeIntoExistingCss(parsed, existingCss);
    if (merged !== null) return merged;
  }
  const parts: string[] = [];
  if (parsed.fontImportUrls.length > 0) {
    parts.push(
      '/* scamp: font imports — managed by Project Settings → Fonts */'
    );
    for (const url of parsed.fontImportUrls) {
      parts.push(`@import url("${url}");`);
    }
    parts.push('');
  }
  if (parsed.tokens.length === 0) {
    parts.push(':root {\n}');
  } else {
    const lines = parsed.tokens.map((t) => `  ${t.name}: ${t.value};`);
    parts.push(`:root {\n${lines.join('\n')}\n}`);
  }
  for (const block of parsed.themes ?? []) {
    if (block.tokens.length === 0) continue;
    const lines = block.tokens.map((t) => `  ${t.name}: ${t.value};`);
    parts.push('');
    parts.push(`.${block.cssClass} {\n${lines.join('\n')}\n}`);
  }
  return parts.join('\n') + '\n';
};
