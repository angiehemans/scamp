import type { Locator, Page } from '@playwright/test';
/**
 * Centralized query helpers. Everything the specs look up goes
 * through here so renaming an id / restructuring the DOM only
 * touches this file.
 *
 * Specs should prefer role/text/placeholder queries first and reach
 * for `data-testid` only where role queries are ambiguous.
 */
/**
 * The root `<div data-scamp-id="root">` of the ACTIVE target (page or
 * component being edited). Scoped by `data-element-id="root"` so we
 * don't match a component instance's inner root that's also rendered
 * inline on the canvas.
 */
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
/** Sidebar component button by PascalCase name. Scoped to the components list. */
export declare const componentSidebarItem: (page: Page, name: string) => Locator;
/** "+ Add Component" sidebar button. Scoped to the components section. */
export declare const addComponentButton: (page: Page) => Locator;
/** Currently-open context menu surface (PageContextMenu / ElementContextMenu). */
export declare const contextMenu: (page: Page) => Locator;
/** A specific item inside the open context menu, by visible label. */
export declare const contextMenuItem: (page: Page, label: string) => Locator;
