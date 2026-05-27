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
export const pageRoot = (page) => page.locator('[data-element-id="root"][data-scamp-id="root"]');
/** A drawn element on the canvas, by its CSS class name (e.g. `rect_a1b2`). */
export const canvasElement = (page, className) => page.locator(`[data-scamp-id="${className}"]`);
/** The scaled frame the canvas renders inside. */
export const canvasFrame = (page) => page.locator('[data-testid="canvas-frame"]');
/** The toolbar button for a given tool (exposed via role=button + accessible name). */
export const toolButton = (page, label) => page.getByRole('button', { name: new RegExp(`^${label}\\s`) });
/** The save-status indicator in the header. */
export const saveStatus = (page) => page.locator('[data-testid="save-status"]');
/** A row in the layers panel, by its visible label. */
export const layersRow = (page, label) => page.locator('nav, aside').getByRole('button', { name: label }).first();
/** A resize handle on the current selection overlay (nw, n, ne, e, se, s, sw, w). */
export const resizeHandle = (page, handle) => page.locator(`[data-handle="${handle}"]`);
/** Selectors for canvas elements whose class name begins with `prefix`. */
export const canvasElementsByPrefix = (page, prefix) => page.locator(`[data-scamp-id^="${prefix}"]`);
/**
 * The components-section list in the sidebar — the `<ul>` immediately
 * following the "Components" heading. Scoping our queries here keeps
 * us from accidentally matching the canvas breadcrumb button which
 * also carries the component name when an editor is open.
 */
const componentsList = (page) => page.locator('h2:has-text("Components") + ul');
/** Sidebar component button by PascalCase name. Scoped to the components list. */
export const componentSidebarItem = (page, name) => componentsList(page).getByRole('button', { name, exact: true });
/** "+ Add Component" sidebar button. Scoped to the components section. */
export const addComponentButton = (page) => page.getByRole('button', { name: /Add Component/i });
/** Currently-open context menu surface (PageContextMenu / ElementContextMenu). */
export const contextMenu = (page) => page.getByRole('menu');
/** A specific item inside the open context menu, by visible label. */
export const contextMenuItem = (page, label) => contextMenu(page).getByRole('menuitem', { name: label });
