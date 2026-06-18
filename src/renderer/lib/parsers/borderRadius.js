import { parsePx } from "./common";
import { parsePaddingShorthandOrNull } from "./padding";
/**
 * Parse a CSS `border-radius` shorthand into [TL, TR, BR, BL] in px.
 *
 * CSS border-radius shorthand order:
 *   1 value  → all four corners
 *   2 values → (top-left + bottom-right) (top-right + bottom-left)
 *   3 values → top-left (top-right + bottom-left) bottom-right
 *   4 values → top-left top-right bottom-right bottom-left
 *
 * Only the radius part before any `/` is parsed — the vertical radius
 * (elliptical corners) is ignored for POC.
 */
export const parseBorderRadiusShorthand = (raw) => {
    if (typeof raw !== 'string')
        return [0, 0, 0, 0];
    // Strip everything after `/` (vertical radius for elliptical corners).
    const horizontal = raw.split('/')[0] ?? '';
    const tokens = horizontal.trim().split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length === 0)
        return [0, 0, 0, 0];
    const v = tokens.map(parsePx);
    if (v.length === 1) {
        const [a] = v;
        return [a, a, a, a];
    }
    if (v.length === 2) {
        const [a, b] = v;
        return [a, b, a, b];
    }
    if (v.length === 3) {
        const [a, b, c] = v;
        return [a, b, c, b];
    }
    const [a, b, c, d] = v;
    return [a, b, c, d];
};
/**
 * Refusable variant of `parseBorderRadiusShorthand`. 1-4 px or var()
 * tokens are accepted; anything else (`50%`, `1.5em`, the elliptical
 * slash form) returns null so the raw declaration round-trips via
 * customProperties.
 */
export const parseBorderRadiusShorthandOrNull = (raw) => {
    if (typeof raw !== 'string')
        return null;
    // Reject elliptical-corner shorthand entirely so the slash form
    // round-trips verbatim instead of being silently truncated.
    if (raw.includes('/'))
        return null;
    return parsePaddingShorthandOrNull(raw);
};
