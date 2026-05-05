/**
 * Classify a raw `href` value into the kinds the Link section's UI
 * cares about. Pure: takes the href + the project's page list, returns
 * a tagged union.
 *
 * The Link section uses this on every render to decide which control
 * group is active (page dropdown / external URL / custom passthrough),
 * so there's no separate "kind" field stored on the element — the
 * file is the source of truth.
 */
const EXTERNAL_SCHEMES = /^(?:https?:|mailto:|tel:|sms:|ftp:|ftps:)/i;
/**
 * Schemes we deliberately refuse to interpret as "external" because
 * they're a security footgun in a webview-hosted preview. The Link
 * section's URL field rejects these on input; if one slips in via a
 * hand-edit, we surface it as `custom` so the dropdown doesn't claim
 * it as a real external link.
 */
const FORBIDDEN_SCHEMES = /^(?:javascript:|data:|vbscript:)/i;
export const classifyHref = (rawHref, pageNames) => {
    const href = (rawHref ?? '').trim();
    if (href.length === 0)
        return { kind: 'none' };
    if (FORBIDDEN_SCHEMES.test(href)) {
        return { kind: 'custom', raw: href };
    }
    if (EXTERNAL_SCHEMES.test(href)) {
        return { kind: 'external', url: href };
    }
    // Internal page reference: starts with `/` and the path segment
    // matches a known page name. The path segment is everything after
    // the leading `/` up to the next `/`, `#`, or `?`. The home page
    // is the bare `/`.
    if (href.startsWith('/')) {
        if (href === '/') {
            // Home page. The internal page name is `'home'` — not a real
            // route segment but Scamp's internal label.
            return pageNames.includes('home')
                ? { kind: 'page', pageName: 'home' }
                : { kind: 'broken', pageName: 'home' };
        }
        const slug = href.slice(1).split(/[\/?#]/)[0] ?? '';
        if (slug.length === 0)
            return { kind: 'custom', raw: href };
        return pageNames.includes(slug)
            ? { kind: 'page', pageName: slug }
            : { kind: 'broken', pageName: slug };
    }
    // Anything else (fragment, relative path, bare token) lands in
    // custom — round-trips via the attribute bag, but the Link section
    // doesn't claim to model it.
    return { kind: 'custom', raw: href };
};
/** Inverse: emit the href string for an internal page reference. */
export const pageNameToHref = (pageName) => pageName === 'home' ? '/' : `/${pageName}`;
/**
 * True when a URL string passes the Link section's external-URL
 * validation (modern scheme, no forbidden schemes). Used to gate the
 * URL text input — invalid input shows an inline error rather than
 * landing in the file.
 */
export const isValidExternalUrl = (raw) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0)
        return false;
    if (FORBIDDEN_SCHEMES.test(trimmed))
        return false;
    return EXTERNAL_SCHEMES.test(trimmed);
};
