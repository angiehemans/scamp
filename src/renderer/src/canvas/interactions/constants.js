// Default sizes + thresholds for the canvas draw / drop tools.
/** Default size for image elements placed via click (not drag). */
export const DEFAULT_IMAGE_SIZE = 200;
/**
 * If the user just clicks (rather than drag-drawing) with the rectangle
 * tool, we drop a default-sized rect centered on the cursor. Anything
 * smaller than `CLICK_DRAG_THRESHOLD` on either axis counts as "click,
 * not drag".
 */
export const CLICK_DRAG_THRESHOLD = 5;
export const DEFAULT_NEW_RECT_SIZE = 200;
/** Default size for an input element placed via click (not drag). */
export const DEFAULT_NEW_INPUT_WIDTH = 240;
export const DEFAULT_NEW_INPUT_HEIGHT = 32;
