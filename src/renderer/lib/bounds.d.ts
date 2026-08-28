/**
 * Minimum element size — matches the floor used by the draw/resize
 * interactions. Any rect smaller than this would be hard to click and
 * is collapsed to this size by the clamp.
 */
export declare const MIN_SIZE = 20;
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
export declare const clampSizeToParent: (w: number, h: number, parentW: number, parentH: number) => {
    w: number;
    h: number;
};
/**
 * Clamp a candidate (x, y, w, h) rect so it stays inside (parentW, parentH).
 *
 * Used by draw, drag-move, drag-resize, and arrow-key nudge to enforce
 * "children can't escape their parent". The rect is shrunk before being
 * shifted, so a rect that's too big for the parent ends up flush at
 * (0, 0) with size = parent size, not outside the bounds.
 */
export declare const clampToParent: (x: number, y: number, w: number, h: number, parentW: number, parentH: number) => {
    x: number;
    y: number;
    w: number;
    h: number;
};
