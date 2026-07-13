// Pure zoom math shared by the canvas zoom controls and the wheel/pinch
// handler. Kept out of the Viewport component so the gesture → scale
// mapping is unit-testable (see test/zoom.test.ts). The +/- buttons and
// keys step by ZOOM_BUTTON_STEP; wheel/pinch is continuous. Both clamp to
// [MIN_ZOOM, MAX_ZOOM].

/**
 * Continuous-zoom floor. Deliberately below the discrete ladder's 0.25
 * because auto-fit can already resolve smaller for very wide canvases, so
 * pinching out shouldn't snap back up to a higher minimum.
 */
export const MIN_ZOOM = 0.1;

/** Continuous-zoom ceiling — matches the top of the discrete ladder. */
export const MAX_ZOOM = 4;

/**
 * How aggressively wheel/trackpad delta maps to zoom. Exponential mapping
 * (scale · e^(-delta·k)) feels linear to the hand because each notch is a
 * constant *ratio* rather than a constant additive step.
 */
export const ZOOM_SENSITIVITY = 0.01;

/**
 * Additive step for the +/- buttons and Cmd/Ctrl +/- keys, in scale units
 * (0.15 === 15 percentage points). Applied relative to the *current
 * effective* scale — so from a 60% fit the first tap lands on 75%, not a
 * fixed ladder rung. Small, uniform steps beat the old non-uniform ladder
 * for fine adjustment.
 */
export const ZOOM_BUTTON_STEP = 0.15;

/** Clamp a scale to the continuous-zoom range. */
export const clampZoom = (scale: number): number =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));

/**
 * One button/keyboard step from the current effective scale. `direction`
 * is +1 (in) or -1 (out). A fixed additive step from wherever the user is
 * now (a 60% fit → 75%), clamped to [MIN_ZOOM, MAX_ZOOM].
 */
export const stepZoom = (current: number, direction: 1 | -1): number =>
  clampZoom(current + direction * ZOOM_BUTTON_STEP);

/**
 * Next scale from a wheel/pinch delta, anchored on the current effective
 * scale. Positive `deltaY` (scroll down / pinch in) zooms OUT, matching the
 * browser's native ctrl-wheel convention. Result is clamped to
 * [MIN_ZOOM, MAX_ZOOM].
 */
export const nextZoomFromWheel = (current: number, deltaY: number): number =>
  clampZoom(current * Math.exp(-deltaY * ZOOM_SENSITIVITY));
