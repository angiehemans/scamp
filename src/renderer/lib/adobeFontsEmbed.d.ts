/**
 * Parser for the two embed forms Adobe Fonts' "Web Project" dialog
 * exposes:
 *
 *   <link rel="stylesheet" href="https://use.typekit.net/abc1def.css">
 *   @import url("https://use.typekit.net/abc1def.css");
 *   https://use.typekit.net/abc1def.css   (bare URL)
 *
 * Unlike Google Fonts, the URL is opaque — `abc1def` is a kit ID and
 * tells us nothing about which families are inside. Resolving family
 * names requires a follow-up fetch (see `adobeFontsFetch.ts`).
 *
 * We deliberately do NOT accept Adobe's legacy
 * `<script src="…/abc1def.js">` embed form. That form depends on
 * runtime JS execution to inject `<style>` tags, which is awkward to
 * inject into Scamp's renderer and unnecessary — Adobe's UI defaults
 * to the modern CSS form anyway.
 */
export type ParsedAdobeEmbed = {
    url: string;
    kitId: string;
};
export type AdobeParseResult = {
    ok: true;
    value: ParsedAdobeEmbed;
} | {
    ok: false;
    error: string;
};
export declare const parseAdobeFontsEmbed: (raw: string) => AdobeParseResult;
