import type { Locator, Page } from '@playwright/test';
/**
 * Centralized query helpers. Everything the specs look up goes
 * through here so renaming an id / restructuring the DOM only
 * touches this file.
 *
 * Specs should prefer role/text/placeholder queries first and reach
 * for `data-testid` only where role queries are ambiguous.
 */
/** The root `<div data-scamp-id="root">` of the active page on the canvas. */
export declare const pageRoot: (page: Page) => Locator;
/** A drawn element on the canvas, by its CSS class name (e.g. `rect_a1b2`). */
export declare const canvasElement: (page: Page, className: string) => Locator;
/** The scaled frame the canvas renders inside. */
export declare const canvasFrame: (page: Page) => Locator;
/** The toolbar button for a given tool (exposed via role=button + accessible name). */
export declare const toolButton: (page: Page, label: string) => Locator;
/** The save-status indicator in the header. */
export declare const saveStatus: (page: Page) => Locator;
/** A row in the layers panel, by its visible label. */
export declare const layersRow: (page: Page, label: string) => Locator;
/** A resize handle on the current selection overlay (nw, n, ne, e, se, s, sw, w). */
export declare const resizeHandle: (page: Page, handle: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w") => Locator;
/** Selectors for canvas elements whose class name begins with `prefix`. */
export declare const canvasElementsByPrefix: (page: Page, prefix: string) => Locator;
