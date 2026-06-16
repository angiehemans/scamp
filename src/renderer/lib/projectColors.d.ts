import type { ScampElement } from './element';
/**
 * Extract all color values used across an element map. Deduplicated and
 * sorted by frequency (most used first). Returns an empty array when no
 * meaningful colors are found. Pure — the store's `selectProjectColors`
 * selector is a thin wrapper that passes `state.elements`.
 */
export declare const projectColorsFromElements: (elements: Record<string, ScampElement>) => string[];
