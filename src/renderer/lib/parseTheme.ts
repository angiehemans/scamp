import postcss from 'postcss';
import type { ThemeToken } from '@shared/types';

/**
 * Parse a CSS file and extract all custom properties (`--*`) from
 * `:root` rule blocks. Returns an ordered list of tokens — last
 * declaration wins when duplicates exist (same as CSS cascade).
 *
 * Non-`:root` rules and non-custom-property declarations are ignored.
 * Malformed CSS returns an empty array rather than throwing.
 */
export const parseThemeCss = (css: string): ThemeToken[] => {
  if (typeof css !== 'string' || css.trim().length === 0) return [];

  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return [];
  }

  const tokenMap = new Map<string, string>();

  root.walkRules((rule) => {
    if (rule.selector.trim() !== ':root') return;
    rule.walkDecls((decl) => {
      if (!decl.prop.startsWith('--')) return;
      tokenMap.set(decl.prop, decl.value);
    });
  });

  return [...tokenMap.entries()].map(([name, value]) => ({ name, value }));
};
