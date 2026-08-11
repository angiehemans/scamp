import type { Locator, Page } from '@playwright/test';
/** The Layers panel section in the sidebar. */
export declare const layersPanel: (page: Page) => Locator;
/** A row in the layers panel, matched by the element's CSS class name. */
export declare const layersRowByClass: (page: Page, className: string) => Locator;
/** Every layer row in source order. */
export declare const layersRows: (page: Page) => Locator;
/**
 * The disclosure triangle on a layer row, by the element's CSS class.
 *
 * Targets `data-action` rather than the icon markup, so restyling the
 * chevron doesn't break every collapse spec.
 */
export declare const collapseToggle: (page: Page, className: string) => Locator;
/** The dot marking a collapsed row that hides the current selection. */
export declare const hiddenSelectionDot: (page: Page, className: string) => Locator;
