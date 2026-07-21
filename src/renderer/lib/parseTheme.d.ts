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
/**
 * Derive a `ThemeDef` from a theme block's CSS class. `dark` → the
 * built-in Dark theme; `theme-<slug>` → a custom theme whose id is the
 * slug and whose label is the slug title-cased.
 */
export declare const themeDefFromClass: (cssClass: string) => ThemeDef;
/** The light theme is always present, backed by the `:root` block. */
export declare const LIGHT_THEME: ThemeDef;
/**
 * The ordered theme list for a parsed file: Light (always) followed by
 * each override block in source order.
 */
export declare const themeDefsFromParsed: (parsed: ParsedTheme) => ThemeDef[];
/**
 * Flatten to the token list for one theme: the base `:root` tokens with
 * the theme's semantic overrides applied by name. Primitives and
 * typography (which never appear in override blocks) pass through
 * unchanged; an override naming a token absent from the base is appended.
 */
export declare const deriveThemeTokens: (base: ReadonlyArray<ThemeToken>, overrides: ReadonlyArray<ThemeToken>) => ThemeToken[];
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
