/**
 * Shared helpers for the color picker chrome. Lives separately so
 * the pure logic can be unit-tested without pulling in React.
 */
/**
 * Expand `#rgb` shorthand to `#rrggbb`, lowercased. Any input
 * that isn't exactly a 3-digit hex passes through unchanged —
 * `#aabbcc`, `rgba(...)`, `var(--accent)`, named colors, etc.
 * all round-trip.
 */
export declare const expandHexShorthand: (raw: string) => string;
