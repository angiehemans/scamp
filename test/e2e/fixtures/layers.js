/** The Layers panel section in the sidebar. */
export const layersPanel = (page) => page.locator('[data-testid="layers-panel"]');
/** A row in the layers panel, matched by the element's CSS class name. */
export const layersRowByClass = (page, className) => layersPanel(page).locator(`[data-element-class="${className}"]`);
/** Every layer row in source order. */
export const layersRows = (page) => layersPanel(page).locator('[data-testid="layers-row"]');
