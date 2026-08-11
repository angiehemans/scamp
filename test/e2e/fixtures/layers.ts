import type { Locator, Page } from '@playwright/test';

/** The Layers panel section in the sidebar. */
export const layersPanel = (page: Page): Locator =>
  page.locator('[data-testid="layers-panel"]');

/** A row in the layers panel, matched by the element's CSS class name. */
export const layersRowByClass = (page: Page, className: string): Locator =>
  layersPanel(page).locator(`[data-element-class="${className}"]`);

/** Every layer row in source order. */
export const layersRows = (page: Page): Locator =>
  layersPanel(page).locator('[data-testid="layers-row"]');

/**
 * The disclosure triangle on a layer row, by the element's CSS class.
 *
 * Targets `data-action` rather than the icon markup, so restyling the
 * chevron doesn't break every collapse spec.
 */
export const collapseToggle = (page: Page, className: string): Locator =>
  layersPanel(page)
    .locator(`[data-element-class="${className}"]`)
    .locator('[data-action="toggle-collapse"]');

/** The dot marking a collapsed row that hides the current selection. */
export const hiddenSelectionDot = (page: Page, className: string): Locator =>
  layersPanel(page)
    .locator(`[data-element-class="${className}"]`)
    .locator('[data-testid="hidden-selection-dot"]');
