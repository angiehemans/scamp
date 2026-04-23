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
