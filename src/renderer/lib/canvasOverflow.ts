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
export const overflowExtent = (scroll: number, client: number): number =>
  Math.max(0, Math.round(scroll - client));

/**
 * Sub-pixel slack, in logical px, allowed between a measured content
 * extent and the frame's own box before the content counts as
 * overflowing. see docs/notes/canvas-extent-oscillation.md
 */
export const CONTENT_EXTENT_TOLERANCE_PX = 2;

/**
 * Snap a measured content extent onto the frame's own box when the two are
 * within `tolerance` px of each other.
 *
 * The canvas measures content by dividing client rects by the applied
 * scale, so at a fractional zoom an element exactly as wide as the frame
 * measures a hair over or under it. Rounding that raw figure makes it
 * alternate between `frameBox` and `frameBox + 1`, and the canvas feeds
 * the extent back into its own zoom — so the alternation never settles.
 * Anything inside the tolerance reports as "exactly the frame", which is
 * both stable and true. Real overflow rounds up, so the boundary label
 * never under-reports. see docs/notes/canvas-extent-oscillation.md
 */
export const settleExtent = (
  measured: number,
  frameBox: number,
  tolerance: number = CONTENT_EXTENT_TOLERANCE_PX
): number => {
  if (!Number.isFinite(measured)) return frameBox;
  return measured - frameBox > tolerance ? Math.ceil(measured) : frameBox;
};

/**
 * Label for an overflow indicator, e.g. `"+ 240px overflow"`. Empty
 * string when there's no overflow so callers can render nothing.
 */
export const formatOverflowLabel = (px: number): string =>
  px > 0 ? `+ ${px}px overflow` : '';
