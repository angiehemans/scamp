/** Default size for image elements placed via click (not drag). */
export declare const DEFAULT_IMAGE_SIZE = 200;
/**
 * If the user just clicks (rather than drag-drawing) with the rectangle
 * tool, we drop a default-sized rect centered on the cursor. Anything
 * smaller than `CLICK_DRAG_THRESHOLD` on either axis counts as "click,
 * not drag".
 */
export declare const CLICK_DRAG_THRESHOLD = 5;
export declare const DEFAULT_NEW_RECT_SIZE = 200;
/** Default size for an input element placed via click (not drag). */
export declare const DEFAULT_NEW_INPUT_WIDTH = 240;
export declare const DEFAULT_NEW_INPUT_HEIGHT = 32;
/**
 * Dropped / pasted SVGs at or under this many bytes are inlined as an
 * editable `<svg>` element (fill/stroke editable); larger ones are copied
 * into assets and referenced as `<img>` to keep the TSX lean.
 * see docs/plans/svg-improvements-plan.md
 */
export declare const INLINE_SVG_MAX_BYTES: number;
