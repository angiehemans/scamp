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
