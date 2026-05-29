/**
 * Parser for the three forms Google Fonts' "Get embed code" tab
 * exposes:
 *
 *   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap" rel="stylesheet">
 *   @import url('https://fonts.googleapis.com/css2?family=Inter&display=swap');
 *   https://fonts.googleapis.com/css2?family=Inter&display=swap   (bare URL)
 *
 * We only accept Google Fonts URLs so users can't paste arbitrary
 * stylesheets into the font system — those should stay as hand-
 * edited `@import` lines the user writes themselves.
 */
export type ParsedGoogleEmbed = {
    url: string;
    families: string[];
};
export type ParseResult = {
    ok: true;
    value: ParsedGoogleEmbed;
} | {
    ok: false;
    error: string;
};
/**
 * Drop a single family from a Google Fonts URL.
 *
 *   - Returns the rewritten URL when other families remain.
 *   - Returns `null` when the removed family was the last one, so
 *     the caller knows to drop the URL entry entirely.
 *   - Returns the input unchanged when the URL can't be parsed or
 *     the family isn't found — the safe default so a bug doesn't
 *     wipe the user's theme.
 *
 * Matches families by their display name (the result of
 * `prettyFamily`), not by the raw `family=...:wght@...` segment, so
 * the caller can pass the same string we show in the UI.
 */
export declare const removeFamilyFromUrl: (url: string, family: string) => string | null;
export declare const parseGoogleFontsEmbed: (raw: string) => ParseResult;
