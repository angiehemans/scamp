/**
 * `@font-face` rules with the font files inlined, for a capture.
 *
 * A capture rasterises through `<img src="data:image/svg+xml,…">`, and
 * that document cannot fetch anything. A webfont the page loads over
 * the network is simply unavailable inside it, so the text falls back
 * — which is why every thumbnail came out in the wrong typeface for a
 * project whose design uses one.
 *
 * `skipFonts` was set for a real reason: html-to-image's own walk reads
 * `cssRules` on every sheet, which throws for a cross-origin one —
 * Google Fonts here — and it logs each failure. That part was right.
 * What followed it ("those fonts could never be embedded anyway") was
 * not: the SHEET cannot be read cross-origin, but it can be fetched by
 * href, and the font files it points at serve CORS headers. So they are
 * fetched here instead of read, and handed to html-to-image as
 * `fontEmbedCSS`, which makes it skip its own walk entirely.
 *
 * see docs/notes/project-thumbnails.md
 */
/** One `@font-face { … }` block. */
const FONT_FACE_RE = /@font-face\s*\{[^}]*\}/g;
/** A `url(…)`, however it is quoted. */
const URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
/**
 * How much font to inline before giving up.
 *
 * A Google Fonts stylesheet declares a face per weight per unicode
 * range, so a six-weight family is dozens of files. The families in use
 * are filtered first, and this is the backstop for the page that uses a
 * lot of them: a thumbnail is not worth ten megabytes of base64.
 */
export const MAX_EMBED_BYTES = 2_000_000;
/** The `font-family` a rule declares, unquoted and lowercased. */
export const familyOf = (fontFace) => {
    const match = fontFace.match(/font-family\s*:\s*([^;]+)/i);
    const raw = match?.[1]?.trim();
    if (raw === undefined || raw.length === 0)
        return null;
    return raw.replace(/^['"]|['"]$/g, '').toLowerCase();
};
/**
 * The families actually set on a subtree, as `font-family` head names.
 *
 * Embedding every face a project declares would put fonts nothing on
 * the page uses into every capture.
 */
export const familiesUsedIn = (root) => {
    const out = new Set();
    const add = (el) => {
        const stack = window.getComputedStyle(el).fontFamily;
        for (const part of stack.split(',')) {
            const name = part.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
            if (name.length > 0)
                out.add(name);
        }
    };
    add(root);
    for (const el of root.querySelectorAll('*'))
        add(el);
    return out;
};
/** Every code point in some text, for matching against a `unicode-range`. */
export const codePointsOf = (text) => {
    const out = new Set();
    for (const ch of text) {
        const cp = ch.codePointAt(0);
        if (cp !== undefined)
            out.add(cp);
    }
    return out;
};
/**
 * Does a `unicode-range` include any of these code points?
 *
 * A face with no range covers everything, which is what a self-hosted
 * single-file font looks like.
 */
export const rangeCovers = (unicodeRange, codePoints) => {
    if (unicodeRange === null)
        return true;
    for (const part of unicodeRange.split(',')) {
        const token = part.trim().toUpperCase();
        if (!token.startsWith('U+'))
            continue;
        const body = token.slice(2);
        let low;
        let high;
        if (body.includes('-')) {
            const [from, to] = body.split('-');
            low = Number.parseInt(from ?? '', 16);
            high = Number.parseInt(to ?? '', 16);
        }
        else if (body.includes('?')) {
            // `U+30??` is the wildcard form: a range with the digits filled in.
            low = Number.parseInt(body.replace(/\?/g, '0'), 16);
            high = Number.parseInt(body.replace(/\?/g, 'F'), 16);
        }
        else {
            low = Number.parseInt(body, 16);
            high = low;
        }
        if (!Number.isFinite(low) || !Number.isFinite(high))
            continue;
        for (const cp of codePoints) {
            if (cp >= low && cp <= high)
                return true;
        }
    }
    return false;
};
/** The `unicode-range` a rule declares, or null when it declares none. */
export const unicodeRangeOf = (fontFace) => {
    const match = fontFace.match(/unicode-range\s*:\s*([^;}]+)/i);
    return match?.[1]?.trim() ?? null;
};
/**
 * The `@font-face` blocks a capture actually needs: a family that is in
 * use, covering a character that is on the page.
 *
 * The second half is not an optimisation. A Google Fonts stylesheet is
 * a face per weight PER SUBSET — six weights of one family is 42 rules
 * — and it orders `latin` LAST in each group of seven. Embedding them
 * in order filled the byte cap on cyrillic, greek and vietnamese that
 * no English page renders, and stopped before the latin faces the text
 * was actually set in. The font fell back, and only on the projects
 * with enough weights or families to reach the cap.
 */
export const fontFacesFor = (css, families, codePoints) => {
    const out = [];
    for (const block of css.match(FONT_FACE_RE) ?? []) {
        const family = familyOf(block);
        if (family === null || !families.has(family))
            continue;
        if (!rangeCovers(unicodeRangeOf(block), codePoints))
            continue;
        out.push(block);
    }
    return out;
};
/** Read a stylesheet's text, fetching it when the browser will not read it. */
const cssTextOf = async (sheet) => {
    try {
        const rules = Array.from(sheet.cssRules);
        const parts = [];
        for (const rule of rules) {
            // An `@import` of a cross-origin sheet is the Google Fonts case:
            // the rule is readable, the sheet it points at is not.
            const imported = rule.styleSheet;
            if (imported !== undefined && imported !== null) {
                parts.push(await cssTextOf(imported));
                continue;
            }
            parts.push(rule.cssText);
        }
        return parts.join('\n');
    }
    catch {
        if (!sheet.href)
            return '';
        try {
            const response = await fetch(sheet.href);
            return response.ok ? await response.text() : '';
        }
        catch {
            return '';
        }
    }
};
/** A URL as a `data:` URI, or null when it cannot be had. */
const asDataUri = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok)
            return null;
        const blob = await response.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    }
    catch {
        return null;
    }
};
/**
 * Build the CSS to hand html-to-image as `fontEmbedCSS`.
 *
 * Returns an empty string when there is nothing to embed, which is the
 * common case for a design on system fonts — the caller then leaves
 * `skipFonts` on and nothing is fetched at all.
 */
export const buildFontEmbedCss = async (root) => {
    const families = familiesUsedIn(root);
    if (families.size === 0)
        return '';
    const sheets = await Promise.all(Array.from(document.styleSheets).map((sheet) => cssTextOf(sheet)));
    const faces = fontFacesFor(sheets.join('\n'), families, codePointsOf(root.textContent ?? ''));
    if (faces.length === 0)
        return '';
    const out = [];
    let bytes = 0;
    for (const face of faces) {
        const urls = [...face.matchAll(URL_RE)].map((m) => m[2] ?? '');
        let rewritten = face;
        let ok = urls.length === 0;
        for (const url of urls) {
            if (url.startsWith('data:')) {
                ok = true;
                continue;
            }
            const absolute = new URL(url, document.baseURI).href;
            const data = await asDataUri(absolute);
            if (data === null)
                continue;
            rewritten = rewritten.replace(url, data);
            bytes += data.length;
            ok = true;
        }
        if (ok)
            out.push(rewritten);
        if (bytes >= MAX_EMBED_BYTES) {
            // Said out loud: the symptom of hitting this is a thumbnail in
            // the wrong typeface, with nothing anywhere to explain it.
            console.warn(`[embedFonts] stopped at ${MAX_EMBED_BYTES} bytes with ${faces.length - out.length} faces left; the capture may fall back`);
            break;
        }
    }
    return out.join('\n');
};
