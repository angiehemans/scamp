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
export const pageRoot = (page: Page): Locator =>
  page.locator('[data-scamp-id="root"]');

/** A drawn element on the canvas, by its CSS class name (e.g. `rect_a1b2`). */
export const canvasElement = (page: Page, className: string): Locator =>
  page.locator(`[data-scamp-id="${className}"]`);

/** The scaled frame the canvas renders inside. */
export const canvasFrame = (page: Page): Locator =>
  page.locator('[data-testid="canvas-frame"]');

/** The toolbar button for a given tool (exposed via role=button + accessible name). */
export const toolButton = (page: Page, label: string): Locator =>
  page.getByRole('button', { name: new RegExp(`^${label}\\s`) });

/** The save-status indicator in the header. */
export const saveStatus = (page: Page): Locator =>
  page.locator('[data-testid="save-status"]');

/** A row in the layers panel, by its visible label. */
export const layersRow = (page: Page, label: string): Locator =>
  page.locator('nav, aside').getByRole('button', { name: label }).first();

/** A resize handle on the current selection overlay (nw, n, ne, e, se, s, sw, w). */
export const resizeHandle = (
  page: Page,
  handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
): Locator => page.locator(`[data-handle="${handle}"]`);

/** Selectors for canvas elements whose class name begins with `prefix`. */
export const canvasElementsByPrefix = (page: Page, prefix: string): Locator =>
  page.locator(`[data-scamp-id^="${prefix}"]`);
