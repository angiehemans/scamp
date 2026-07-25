// @lib/gridTemplate.ts — a structured lens over the opaque
// `gridTemplateColumns` / `gridTemplateRows` CSS strings stored on an
// element. The store keeps the raw string (round-tripped verbatim by
// generate/parse); this module parses SIMPLE templates into an editable
// track list and serialises them back. Anything it can't model
// structurally (named lines, subgrid, partial/auto repeat) returns
// null so the UI falls back to a plain text field.
//
// Pure + UI-free so it's unit-testable (see test/gridTemplate.test.ts).
/**
 * Split a track list on whitespace / commas at paren depth 0, so
 * `minmax(100px, 1fr)` stays a single token. Mirrors the paren-aware
 * tokeniser in `controls/FourSideInput.tsx`.
 */
const tokenize = (raw) => {
    const tokens = [];
    let current = '';
    let depth = 0;
    for (const ch of raw) {
        if (ch === '(')
            depth += 1;
        if (ch === ')')
            depth -= 1;
        if (/[\s,]/.test(ch) && depth === 0) {
            if (current.length > 0)
                tokens.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    if (current.length > 0)
        tokens.push(current);
    return tokens;
};
/** Index of the first comma at paren depth 0, or -1. */
const topLevelComma = (raw) => {
    let depth = 0;
    for (let i = 0; i < raw.length; i += 1) {
        const ch = raw[i];
        if (ch === '(')
            depth += 1;
        else if (ch === ')')
            depth -= 1;
        else if (ch === ',' && depth === 0)
            return i;
    }
    return -1;
};
const tokenToTrack = (raw) => {
    const t = raw.trim();
    const lower = t.toLowerCase();
    if (lower === 'auto')
        return { kind: 'auto' };
    if (lower === 'min-content')
        return { kind: 'min-content' };
    if (lower === 'max-content')
        return { kind: 'max-content' };
    const fr = /^(\d*\.?\d+)fr$/i.exec(t);
    if (fr)
        return { kind: 'fr', value: Number(fr[1]) };
    const px = /^(\d*\.?\d+)px$/i.exec(t);
    if (px)
        return { kind: 'px', value: Number(px[1]) };
    const pct = /^(\d*\.?\d+)%$/.exec(t);
    if (pct)
        return { kind: 'percent', value: Number(pct[1]) };
    return { kind: 'raw', source: t };
};
/**
 * Expand a whole-string `repeat(N, <simple list>)` into N copies of its
 * track list. Returns null for `auto-fill` / `auto-fit`, a non-integer
 * count, or a list that itself contains named lines / nested repeat —
 * those aren't structurally editable.
 */
const expandRepeat = (token) => {
    const m = /^repeat\(\s*([\s\S]+)\)$/i.exec(token.trim());
    const inner = m?.[1];
    if (inner === undefined)
        return null;
    const comma = topLevelComma(inner);
    if (comma === -1)
        return null;
    const count = Number(inner.slice(0, comma).trim());
    if (!Number.isInteger(count) || count < 1 || count > 64)
        return null;
    const listTokens = tokenize(inner.slice(comma + 1).trim());
    if (listTokens.length === 0)
        return null;
    if (listTokens.some((t) => t.includes('[') || /repeat\(/i.test(t))) {
        return null;
    }
    const listTracks = listTokens.map(tokenToTrack);
    const out = [];
    for (let i = 0; i < count; i += 1)
        out.push(...listTracks);
    return out;
};
/**
 * Parse a `grid-template-columns` / `-rows` string into an editable
 * track list. Returns:
 *   - `[]` for an empty / whitespace template (no explicit tracks yet).
 *   - `GridTrack[]` for a simple space-separated list (with `minmax()`
 *     etc. preserved as `raw` tracks), or a whole-string `repeat(N, …)`.
 *   - `null` for anything the editor can't model: named lines (`[…]`),
 *     `subgrid` / `masonry`, or `repeat` mixed with other tracks.
 */
export const parseGridTemplate = (template) => {
    const trimmed = template.trim();
    if (trimmed.length === 0)
        return [];
    if (trimmed.includes('['))
        return null; // named grid lines
    if (/\b(subgrid|masonry)\b/i.test(trimmed))
        return null;
    const tokens = tokenize(trimmed);
    if (tokens.length === 0)
        return [];
    const first = tokens[0];
    if (tokens.length === 1 && first !== undefined && /^repeat\(/i.test(first)) {
        return expandRepeat(first);
    }
    // A repeat() alongside other tracks can't be flattened safely.
    if (tokens.some((t) => /^repeat\(/i.test(t)))
        return null;
    return tokens.map(tokenToTrack);
};
const trackToString = (t) => {
    switch (t.kind) {
        case 'fr':
            return `${t.value}fr`;
        case 'px':
            return `${t.value}px`;
        case 'percent':
            return `${t.value}%`;
        case 'auto':
            return 'auto';
        case 'min-content':
            return 'min-content';
        case 'max-content':
            return 'max-content';
        case 'raw':
            return t.source;
    }
};
/** Serialise a track list to a CSS template string (space-separated). */
export const serializeGridTemplate = (tracks) => tracks.map(trackToString).join(' ');
/** N equal fractional tracks — the quick N×M picker's output. */
export const makeFrTracks = (n) => Array.from({ length: Math.max(0, n) }, () => ({ kind: 'fr', value: 1 }));
