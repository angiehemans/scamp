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
import { errorMessage } from '@shared/errorMessage';
/** Match every `font-family: "<name>"` declaration inside an
 *  `@font-face { … }` block. Accepts single or double quotes; the
 *  body match is non-greedy so we don't span across blocks. */
const FONT_FACE_RE = /@font-face\s*\{[^}]*?font-family\s*:\s*["']([^"']+)["'][^}]*?\}/gi;
export const fetchAdobeKitFamilies = async (url) => {
    let response;
    try {
        response = await fetch(url, { cache: 'no-cache' });
    }
    catch (e) {
        const message = errorMessage(e);
        return {
            ok: false,
            error: `Couldn't reach Adobe Fonts (${message}).`,
        };
    }
    if (!response.ok) {
        return {
            ok: false,
            error: `Adobe Fonts returned ${response.status} for that kit URL.`,
        };
    }
    let body;
    try {
        body = await response.text();
    }
    catch (e) {
        const message = errorMessage(e);
        return {
            ok: false,
            error: `Couldn't read the kit's CSS (${message}).`,
        };
    }
    const families = extractFontFamilies(body);
    if (families.length === 0) {
        return {
            ok: false,
            error: "That kit URL didn't return any @font-face declarations. Check the kit is published.",
        };
    }
    return { ok: true, families };
};
/** Exported separately so tests can hit the parser without a fetch. */
export const extractFontFamilies = (css) => {
    const out = new Set();
    for (const match of css.matchAll(FONT_FACE_RE)) {
        const name = match[1]?.trim();
        if (name && name.length > 0)
            out.add(name);
    }
    return [...out].sort((a, b) => a.localeCompare(b));
};
