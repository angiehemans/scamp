/**
 * Classify a theme-token value so the UI can group tokens by intent
 * (colour vs size vs line-height vs font-family) without the user
 * having to declare a category up-front. Pure — feed it the value
 * the user typed into theme.css and get back the bucket.
 */
/** CSS length units we recognise on a numeric token value. */
const LENGTH_UNIT_RE = /^-?\d*\.?\d+(?:px|rem|em|%|pt|vw|vh|vmin|vmax|ch|ex)$/i;
const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_RE = /^rgba?\s*\(/i;
const HSL_RE = /^hsla?\s*\(/i;
/**
 * Names we treat as colour tokens when they appear exactly (no units,
 * no spaces). This is a small allowlist — every CSS named colour isn't
 * worth shipping here. Users who want an obscure named colour can
 * still write it; the classifier just calls it `unknown`.
 */
const COMMON_NAMED_COLORS = new Set([
    'transparent',
    'currentcolor',
    'black',
    'white',
    'red',
    'green',
    'blue',
    'yellow',
    'orange',
    'purple',
    'pink',
    'gray',
    'grey',
    'silver',
    'gold',
    'cyan',
    'magenta',
    'maroon',
    'navy',
    'teal',
    'olive',
    'lime',
    'aqua',
    'fuchsia',
    'rebeccapurple',
]);
/** Generic CSS font families — treated as font-family tokens. */
const GENERIC_FAMILIES = new Set([
    'serif',
    'sans-serif',
    'monospace',
    'cursive',
    'fantasy',
    'system-ui',
    'ui-serif',
    'ui-sans-serif',
    'ui-monospace',
    'ui-rounded',
    'math',
    'emoji',
]);
const UNITLESS_NUMBER_RE = /^-?\d*\.?\d+$/;
export const classifyToken = (raw) => {
    const value = raw.trim();
    if (value.length === 0)
        return 'unknown';
    const lower = value.toLowerCase();
    // 1. Numeric length → font-size. Order matters — check this before
    //    the unitless-number branch so `1.5rem` beats the bare-number
    //    rule.
    if (LENGTH_UNIT_RE.test(value))
        return 'fontSize';
    // 2. Bare number → line-height. Covers `1.5`, `0`, `2`.
    if (UNITLESS_NUMBER_RE.test(value)) {
        const n = Number(value);
        if (Number.isFinite(n))
            return 'lineHeight';
    }
    // 3. Font family: quoted string OR contains a known generic family
    //    anywhere in a comma list. `"Inter", sans-serif` should match
    //    even though the first token is quoted.
    if (/["']/.test(value))
        return 'fontFamily';
    const parts = value.split(',').map((p) => p.trim().toLowerCase());
    if (parts.some((p) => GENERIC_FAMILIES.has(p)))
        return 'fontFamily';
    // 4. Colour forms.
    if (HEX_RE.test(value))
        return 'color';
    if (RGB_RE.test(value))
        return 'color';
    if (HSL_RE.test(value))
        return 'color';
    if (COMMON_NAMED_COLORS.has(lower))
        return 'color';
    return 'unknown';
};
