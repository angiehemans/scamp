/**
 * Shared types used by main, preload, and renderer.
 * All IPC payloads must have explicit types defined here.
 */
/** Stable id of the desktop breakpoint — treated specially throughout. */
export const DESKTOP_BREAKPOINT_ID = 'desktop';
export const DEFAULT_BREAKPOINTS = [
    { id: DESKTOP_BREAKPOINT_ID, label: 'Desktop', width: 1440 },
    { id: 'tablet', label: 'Tablet', width: 768 },
    { id: 'mobile', label: 'Mobile', width: 390 },
];
export const DEFAULT_PROJECT_CONFIG = {
    artboardBackground: '#0f0f0f',
    canvasWidth: 1440,
    canvasOverflowHidden: false,
    breakpoints: DEFAULT_BREAKPOINTS,
};
/** Canvas-width bounds used by both the panel control and the parser. */
export const MIN_CANVAS_WIDTH = 100;
export const MAX_CANVAS_WIDTH = 4000;
