// Pure helpers for the canvas overflow / boundary indicators (backlog-6
// story 2). Kept out of the DOM-measuring Viewport component so the
// arithmetic + label formatting are unit-testable (see
// test/canvasOverflow.test.ts).
/**
 * How far content overflows a box on one axis, in px. `scroll` is the
 * element's scroll size (includes overflowing descendants, even under
 * `overflow: hidden`); `client` is the visible content size. Never
 * negative, and rounded so the label reads in whole pixels.
 */
export const overflowExtent = (scroll, client) => Math.max(0, Math.round(scroll - client));
/**
 * Label for an overflow indicator, e.g. `"+ 240px overflow"`. Empty
 * string when there's no overflow so callers can render nothing.
 */
export const formatOverflowLabel = (px) => px > 0 ? `+ ${px}px overflow` : '';
