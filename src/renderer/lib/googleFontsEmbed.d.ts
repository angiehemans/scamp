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
export declare const parseGoogleFontsEmbed: (raw: string) => ParseResult;
