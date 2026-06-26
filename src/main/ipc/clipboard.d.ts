/**
 * Read the OS clipboard for a canvas paste: SVG markup (text) wins, then
 * a raster image (returned as a PNG data URL), else empty. Sanitization /
 * normalization of svg happens in the renderer (lib/svg) before insert.
 * see docs/plans/svg-improvements-plan.md
 */
export declare const registerClipboardIpc: () => void;
