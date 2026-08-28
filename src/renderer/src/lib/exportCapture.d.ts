/**
 * Inputs for a single capture. The caller resolves the right DOM
 * node beforehand: the canvas frame for page exports, the element
 * node (located via `[data-element-id="…"]`) for element exports.
 */
export type CaptureInputs = {
    node: HTMLElement;
    /** CSS background to paint behind the capture. `null` keeps the
     *  source-element's transparency (typical for PNG element exports). */
    backgroundColor: string | null;
    /** Intrinsic dimensions in CSS px (1× scale). */
    width: number;
    height: number;
};
/**
 * Capture a PNG data URL. PNG is rasterised via foreignObject so the
 * output exactly matches what the user sees on the canvas.
 *
 * `pixelRatio` lets us render at 2× / 3× the intrinsic size for
 * crisp images; the resulting data URL decodes to a buffer of
 * `width × scale` × `height × scale` px.
 */
export declare const capturePng: (inputs: CaptureInputs & {
    scale: 1 | 2 | 3;
}) => Promise<string>;
/**
 * Capture without touching the live canvas.
 *
 * `capturePng` above mutates the real DOM for the duration of the shot —
 * it resets the frame's `transform` and strips selection classes. That is
 * fine for an export the user asked for and waits on. It is not fine for
 * an automatic capture on every save: `Viewport.measureFrame` recovers the
 * applied zoom from `getBoundingClientRect().width / offsetWidth`, so
 * blanking the transform makes the canvas visibly jump to 100% and back on
 * every edit.
 *
 * So: clone the frame, fix the clone up off-screen, and rasterise that.
 * The clone keeps `data-scamp-canvas` and the frame's inline theme
 * custom properties, so the injected `@scope`d page stylesheet and every
 * `var(--…)` still resolve exactly as they do on the real canvas.
 *
 * Returns null when the frame has no size — normal during teardown.
 * see docs/notes/project-thumbnails.md
 */
export declare const captureIsolatedPng: (inputs: {
    node: HTMLElement;
    backgroundColor: string | null;
}) => Promise<string | null>;
/**
 * Capture an SVG string. Resolution-independent — no `pixelRatio`.
 * Some complex CSS effects (filters, blend modes) may not be fully
 * captured; the panel surfaces a one-line warning to set
 * expectations.
 *
 * `html-to-image`'s `toSvg` returns a `data:image/svg+xml;…` URL
 * rather than raw XML. We decode the URL so the file written to
 * disk is real SVG that browsers and downstream tools can read.
 */
export declare const captureSvg: (inputs: CaptureInputs) => Promise<string>;
/**
 * Slugify an export filename. The user can rename in the save dialog;
 * this is just a sane default. Strips path separators and other
 * filename-hostile characters.
 */
export declare const sanitizeExportFilename: (raw: string) => string;
/**
 * Suggest a filename based on the export scope.
 *   - Page scope → the page name (`home`, `about`).
 *   - Element scope → the element's class name (`rect_a1b2`,
 *     `hero-card_a1b2`).
 *
 * The caller passes the resolved name; this helper just sanitises it.
 */
export declare const suggestExportFilename: (name: string) => string;
