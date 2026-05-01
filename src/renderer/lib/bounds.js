/**
 * Minimum element size — matches the floor used by the draw/resize
 * interactions. Any rect smaller than this would be hard to click and
 * is collapsed to this size by the clamp.
 */
export const MIN_SIZE = 20;
/**
 * Clamp a candidate (x, y, w, h) rect so it stays inside (parentW, parentH).
 *
 * Used by draw, drag-move, drag-resize, and arrow-key nudge to enforce
 * "children can't escape their parent". The rect is shrunk before being
 * shifted, so a rect that's too big for the parent ends up flush at
 * (0, 0) with size = parent size, not outside the bounds.
 */
export const clampToParent = (x, y, w, h, parentW, parentH) => {
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
    if (nx + nw > parentW)
        nx = Math.max(0, parentW - nw);
    if (ny + nh > parentH)
        ny = Math.max(0, parentH - nh);
    return { x: nx, y: ny, w: nw, h: nh };
};
