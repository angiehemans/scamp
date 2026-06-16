const EXCLUDED_COLORS = new Set([
    'transparent',
    'inherit',
    'initial',
    'unset',
    'currentColor',
]);
/**
 * Extract all color values used across an element map. Deduplicated and
 * sorted by frequency (most used first). Returns an empty array when no
 * meaningful colors are found. Pure — the store's `selectProjectColors`
 * selector is a thin wrapper that passes `state.elements`.
 */
export const projectColorsFromElements = (elements) => {
    const freq = new Map();
    for (const el of Object.values(elements)) {
        const colors = [el.backgroundColor, el.borderColor, el.color].filter((c) => typeof c === 'string' && c.length > 0 && !EXCLUDED_COLORS.has(c));
        for (const c of colors) {
            freq.set(c, (freq.get(c) ?? 0) + 1);
        }
    }
    if (freq.size === 0)
        return [];
    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([color]) => color);
};
