import type { Locator, Page } from '@playwright/test';
/** The Layers panel section in the sidebar. */
export declare const layersPanel: (page: Page) => Locator;
/** A row in the layers panel, matched by the element's CSS class name. */
export declare const layersRowByClass: (page: Page, className: string) => Locator;
/** Every layer row in source order. */
export declare const layersRows: (page: Page) => Locator;
