/**
 * Shared helpers for the color picker chrome. Lives separately so
 * the pure logic can be unit-tested without pulling in React.
 */
const HEX_SHORTHAND_RE = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;
/**
 * Expand `#rgb` shorthand to `#rrggbb`, lowercased. Any input
 * that isn't exactly a 3-digit hex passes through unchanged —
 * `#aabbcc`, `rgba(...)`, `var(--accent)`, named colors, etc.
 * all round-trip.
 */
export const expandHexShorthand = (raw) => {
    if (typeof raw !== 'string')
        return raw;
    const trimmed = raw.trim();
    const m = trimmed.match(HEX_SHORTHAND_RE);
    if (!m)
        return trimmed;
    const r = m[1];
    const g = m[2];
    const b = m[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
};
