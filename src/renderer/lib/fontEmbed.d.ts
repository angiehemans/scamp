/**
 * Provider-routing helper for pasted font embed snippets. Tries the
 * Google Fonts parser first; falls back to the Adobe Fonts parser;
 * returns a discriminated union the caller switches on.
 *
 * Adding a third provider (Fontshare, Bunny Fonts, self-hosted, etc.)
 * is a matter of:
 *   1. write `parseXxxFontsEmbed` returning the provider's
 *      ParseResult-shaped object
 *   2. extend the `FontEmbedParseResult` union with the new variant
 *   3. add another `if (xxx.ok)` branch below
 */
export type FontEmbedProvider = 'google' | 'adobe';
export type FontEmbedParseResult = {
    ok: true;
    provider: 'google';
    url: string;
    families: string[];
} | {
    ok: true;
    provider: 'adobe';
    url: string;
    kitId: string;
} | {
    ok: false;
    error: string;
};
export declare const parseFontEmbed: (raw: string) => FontEmbedParseResult;
