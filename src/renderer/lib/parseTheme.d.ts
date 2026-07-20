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
/**
 * Parse a CSS file and extract all custom properties (`--*`) from
 * `:root` rule blocks plus every top-level `@import` URL. Returns an
 * ordered list of tokens (last declaration wins on duplicates, same
 * as CSS cascade) and an ordered list of import URLs.
 *
 * Non-`:root` rules and non-custom-property declarations are ignored.
 * Malformed CSS returns empty lists rather than throwing.
 */
export declare const parseThemeFile: (css: string) => ParsedTheme;
/**
 * Backward-compatible token extractor. Prefer `parseThemeFile` when
 * you also need the import URLs.
 */
export declare const parseThemeCss: (css: string) => ThemeToken[];
/**
 * Serialize tokens + font import URLs back to CSS.
 *
 * When `existingCss` is provided, tokens and imports are updated in
 * place and all other CSS (resets, `body {}`, comments) is preserved
 * (see `mergeIntoExistingCss`). Without it — or if that CSS won't parse
 * — this falls back to a full from-scratch write that emits the imports
 * above a single `:root` block.
 */
export declare const serializeThemeFile: (parsed: ParsedTheme, existingCss?: string) => string;
