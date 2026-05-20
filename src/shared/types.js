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
/**
 * Component canvases can be much smaller than page canvases — a
 * button row at 240×40 is normal. Width and height share these
 * bounds and apply only in the component editor.
 */
export const MIN_COMPONENT_CANVAS_DIM = 20;
export const MAX_COMPONENT_CANVAS_DIM = 4000;
/**
 * Starting canvas size for a freshly-created component before the
 * user resizes it. Wide enough to fit a typical card / button
 * layout without feeling cramped; the user resizes via the drag
 * handle or the panel inputs as soon as the design needs it.
 */
export const DEFAULT_COMPONENT_CANVAS_SIZE = {
    width: 480,
    height: 320,
};
