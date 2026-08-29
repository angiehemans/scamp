/**
 * Minimum element size — matches the floor used by the draw/resize
 * interactions. Any rect smaller than this would be hard to click and
 * is collapsed to this size by the clamp.
 */
export declare const MIN_SIZE = 20;
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
