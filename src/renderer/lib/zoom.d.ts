/**
 * Continuous-zoom floor. Deliberately below the discrete ladder's 0.25
 * because auto-fit can already resolve smaller for very wide canvases, so
 * pinching out shouldn't snap back up to a higher minimum.
 */
export declare const MIN_ZOOM = 0.1;
/** Continuous-zoom ceiling — matches the top of the discrete ladder. */
export declare const MAX_ZOOM = 4;
/**
 * How aggressively wheel/trackpad delta maps to zoom. Exponential mapping
 * (scale · e^(-delta·k)) feels linear to the hand because each notch is a
 * constant *ratio* rather than a constant additive step.
 */
export declare const ZOOM_SENSITIVITY = 0.01;
/**
 * Additive step for the +/- buttons and Cmd/Ctrl +/- keys, in scale units
 * (0.15 === 15 percentage points). Applied relative to the *current
 * effective* scale — so from a 60% fit the first tap lands on 75%, not a
 * fixed ladder rung. Small, uniform steps beat the old non-uniform ladder
 * for fine adjustment.
 */
export declare const ZOOM_BUTTON_STEP = 0.15;
/** Clamp a scale to the continuous-zoom range. */
export declare const clampZoom: (scale: number) => number;
/**
 * One button/keyboard step from the current effective scale. `direction`
 * is +1 (in) or -1 (out). A fixed additive step from wherever the user is
 * now (a 60% fit → 75%), clamped to [MIN_ZOOM, MAX_ZOOM].
 */
export declare const stepZoom: (current: number, direction: 1 | -1) => number;
/**
 * Next scale from a wheel/pinch delta, anchored on the current effective
 * scale. Positive `deltaY` (scroll down / pinch in) zooms OUT, matching the
 * browser's native ctrl-wheel convention. Result is clamped to
 * [MIN_ZOOM, MAX_ZOOM].
 */
export declare const nextZoomFromWheel: (current: number, deltaY: number) => number;
