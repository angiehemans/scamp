/**
 * Minimum element size — matches the floor used by the draw/resize
 * interactions. Any rect smaller than this would be hard to click and
 * is collapsed to this size by the clamp.
 */
export const MIN_SIZE = 20;

/**
 * Clamp a drawn box's SIZE to the parent, ignoring where inside the parent
 * it was drawn.
 *
 * For a flex or grid parent the child's position is decided by the layout,
 * not by the drag, so the drawn offset carries no meaning — and feeding it
 * to `clampToParent` actively destroys the drawing. That helper shrinks the
 * width to `parentW - x`, so drawing anywhere near the right of a flex
 * container collapsed the new element to `MIN_SIZE`: a box drawn at x=700
 * in a 720-wide row came out 20px wide, with the height untouched because
 * the same arithmetic on a tall parent left it alone. Correct height, absurd
 * width, only in flex containers.
 *
 * The size is still bounded by the parent so a draw cannot instantly create
 * overflow; only the offset-driven shrink is dropped.
 */
export const clampSizeToParent = (
  w: number,
  h: number,
  parentW: number,
  parentH: number
): { w: number; h: number } => ({
  w: Math.max(MIN_SIZE, Math.min(w, parentW)),
  h: Math.max(MIN_SIZE, Math.min(h, parentH)),
});

/**
 * Clamp a candidate (x, y, w, h) rect so it stays inside (parentW, parentH).
 *
 * Used by draw, drag-move, drag-resize, and arrow-key nudge to enforce
 * "children can't escape their parent". The rect is shrunk before being
 * shifted, so a rect that's too big for the parent ends up flush at
 * (0, 0) with size = parent size, not outside the bounds.
 */
export const clampToParent = (
  x: number,
  y: number,
  w: number,
  h: number,
  parentW: number,
  parentH: number
): { x: number; y: number; w: number; h: number } => {
  let nw = Math.max(MIN_SIZE, w);
  let nh = Math.max(MIN_SIZE, h);
  let nx = x;
  let ny = y;

  // If the rect's left/top is outside the parent, shift it back and
  // shrink the corresponding dimension so the opposite edge stays put.
  if (nx < 0) {
    nw = Math.max(MIN_SIZE, nw + nx);
    nx = 0;
  }
  if (ny < 0) {
    nh = Math.max(MIN_SIZE, nh + ny);
    ny = 0;
  }

  // Shrink to fit if the right/bottom edge spills past the parent.
  if (nx + nw > parentW) {
    nw = Math.max(MIN_SIZE, parentW - nx);
  }
  if (ny + nh > parentH) {
    nh = Math.max(MIN_SIZE, parentH - ny);
  }

  // Final pull-back: if the parent itself is smaller than MIN_SIZE we
  // can still spill — pull x/y in so the rect at least starts inside.
  if (nx + nw > parentW) nx = Math.max(0, parentW - nw);
  if (ny + nh > parentH) ny = Math.max(0, parentH - nh);

  return { x: nx, y: ny, w: nw, h: nh };
};
