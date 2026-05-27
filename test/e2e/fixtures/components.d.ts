import type { Page } from '@playwright/test';
/**
 * Higher-level interactions for the components sidebar and the
 * convert-to-component / detach context menus. Specs use these so
 * they don't repeat the same right-click → menu-item → confirm
 * dialog sequence in every file.
 */
/** Click "+ Add Component", type a name, press Enter. */
export declare const createComponentFromSidebar: (page: Page, name: string) => Promise<void>;
/** Right-click a component in the sidebar; open the context menu. */
export declare const openComponentContextMenu: (page: Page, componentName: string) => Promise<void>;
/** Right-click an element on the canvas (frame-local coords). */
export declare const openElementContextMenu: (page: Page, clientX: number, clientY: number) => Promise<void>;
/** Click a menu item by label inside the currently-open context menu. */
export declare const clickContextMenuItem: (page: Page, label: string) => Promise<void>;
/**
 * Drag a component from the sidebar onto the canvas. Uses the HTML5
 * DnD evaluate pattern because pointer events alone don't fire
 * `dragstart`/`drop` — same approach as `layers-panel/reorder-dnd`.
 */
export declare const dragComponentToCanvas: (page: Page, componentName: string, clientX: number, clientY: number) => Promise<void>;
/** Wait for a ConfirmDialog to appear by its title text. */
export declare const waitForConfirmDialog: (page: Page, titleText: string | RegExp) => Promise<void>;
/** Click the primary confirm button inside the currently-open ConfirmDialog. */
export declare const confirmDialog: (page: Page, label: string | RegExp) => Promise<void>;
