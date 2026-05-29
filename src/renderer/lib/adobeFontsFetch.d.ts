/**
 * Fetch an Adobe Fonts kit URL and extract the family names from the
 * `@font-face` declarations inside.
 *
 * Adobe's URL is opaque — the kit ID doesn't reveal its contents, so
 * to learn the family list we have to retrieve the CSS and parse it.
 * The endpoint is public, served without auth, and CORS-friendly, so
 * a renderer-side `fetch` works (the future renderer CSP will need to
 * allow `use.typekit.net` in `connect-src`).
 *
 * Pure with respect to its input — given a URL string returns a
 * typed result. Network and parse failures are surfaced as
 * `{ ok: false, error }` rather than throwing.
 */
export type AdobeFetchResult = {
    ok: true;
    families: string[];
} | {
    ok: false;
    error: string;
};
export declare const fetchAdobeKitFamilies: (url: string) => Promise<AdobeFetchResult>;
/** Exported separately so tests can hit the parser without a fetch. */
export declare const extractFontFamilies: (css: string) => string[];
