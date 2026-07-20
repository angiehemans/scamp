import postcss from 'postcss';
import type { ThemeToken } from '@shared/types';

export type ParsedTheme = {
  tokens: ThemeToken[];
  /**
   * Ordered `url(...)` values from top-level `@import` at-rules. We
   * care about these because projects track Google Fonts embeds here;
   * callers use them to inject `<link rel="stylesheet">` tags on the
   * canvas preview and to merge Google families into the font picker.
   */
  fontImportUrls: string[];
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

/**
 * Parse a CSS file and extract all custom properties (`--*`) from
 * `:root` rule blocks plus every top-level `@import` URL. Returns an
 * ordered list of tokens (last declaration wins on duplicates, same
 * as CSS cascade) and an ordered list of import URLs.
 *
 * Non-`:root` rules and non-custom-property declarations are ignored.
 * Malformed CSS returns empty lists rather than throwing.
 */
export const parseThemeFile = (css: string): ParsedTheme => {
  if (typeof css !== 'string' || css.trim().length === 0) {
    return { tokens: [], fontImportUrls: [] };
  }

  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return { tokens: [], fontImportUrls: [] };
  }

  const tokenMap = new Map<string, string>();
  const urls: string[] = [];

  root.walkAtRules('import', (atRule) => {
    const url = extractImportUrl(atRule.params);
    if (url && !urls.includes(url)) urls.push(url);
  });

  root.walkRules((rule) => {
    if (rule.selector.trim() !== ':root') return;
    rule.walkDecls((decl) => {
      if (!decl.prop.startsWith('--')) return;
      tokenMap.set(decl.prop, decl.value);
    });
  });

  return {
    tokens: [...tokenMap.entries()].map(([name, value]) => ({ name, value })),
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
  return parts.join('\n') + '\n';
};
