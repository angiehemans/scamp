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

/**
 * Serialize tokens + font import URLs back to CSS. Emits the imports
 * above the `:root` block, mirroring the shape the Fonts panel writes.
 * Hand-edited comments or unrelated rules the parser didn't capture
 * are NOT preserved — this is a full rewrite, so callers that want to
 * keep extra content should avoid this serializer.
 */
export const serializeThemeFile = (parsed: ParsedTheme): string => {
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
