/**
 * How far content overflows a box on one axis, in px. `scroll` is the
 * element's scroll size (includes overflowing descendants, even under
 * `overflow: hidden`); `client` is the visible content size. Never
 * negative, and rounded so the label reads in whole pixels.
 */
export declare const overflowExtent: (scroll: number, client: number) => number;
/**
 * Label for an overflow indicator, e.g. `"+ 240px overflow"`. Empty
 * string when there's no overflow so callers can render nothing.
 */
export declare const formatOverflowLabel: (px: number) => string;
