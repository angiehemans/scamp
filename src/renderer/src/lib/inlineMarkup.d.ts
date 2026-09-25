/**
 * Sanitize one inline fragment for injection into the canvas DOM.
 *
 * Returns `''` for anything that sanitizes away to nothing, so the
 * caller can skip rendering an empty wrapper.
 */
export declare const sanitizeInlineMarkup: (source: string) => string;
