import type { Page } from '@playwright/test';

import {
  addComponentButton,
  componentSidebarItem,
  contextMenuItem,
} from './selectors';

/**
 * Higher-level interactions for the components sidebar and the
 * convert-to-component / detach context menus. Specs use these so
 * they don't repeat the same right-click → menu-item → confirm
 * dialog sequence in every file.
 */

/** Click "+ Add Component", type a name, press Enter. */
export const createComponentFromSidebar = async (
  page: Page,
  name: string
): Promise<void> => {
  await addComponentButton(page).click();
  // The inline name input mounts focused. The button's component-edit
  // state flips to 'new' on click; the next tick renders the input.
  const input = page.getByPlaceholder('ComponentName');
  await input.fill(name);
  await input.press('Enter');
};

/** Right-click a component in the sidebar; open the context menu. */
export const openComponentContextMenu = async (
  page: Page,
  componentName: string
): Promise<void> => {
  await componentSidebarItem(page, componentName).click({ button: 'right' });
};

/** Right-click an element on the canvas (frame-local coords). */
export const openElementContextMenu = async (
  page: Page,
  clientX: number,
  clientY: number
): Promise<void> => {
  await page.mouse.click(clientX, clientY, { button: 'right' });
};

/** Click a menu item by label inside the currently-open context menu. */
export const clickContextMenuItem = async (
  page: Page,
  label: string
): Promise<void> => {
  await contextMenuItem(page, label).click();
};

/**
 * Drag a component from the sidebar onto the canvas. Uses the HTML5
 * DnD evaluate pattern because pointer events alone don't fire
 * `dragstart`/`drop` — same approach as `layers-panel/reorder-dnd`.
 */
export const dragComponentToCanvas = async (
  page: Page,
  componentName: string,
  clientX: number,
  clientY: number
): Promise<void> => {
  await page.evaluate(
    ({ name, x, y }) => {
      // querySelector doesn't support `:has-text`; iterate buttons and
      // match by trimmed text content to find the draggable sidebar
      // row for this component.
      const buttons = Array.from(
        document.querySelectorAll('button')
      ) as HTMLButtonElement[];
      const sourceEl = buttons.find(
        (b) => b.textContent?.trim() === name && b.draggable
      );
      if (!sourceEl) throw new Error(`source not found for component: ${name}`);
      const frame = document.querySelector(
        '[data-testid="canvas-frame"]'
      ) as HTMLElement | null;
      if (!frame) throw new Error('canvas frame not mounted');
      const dt = new DataTransfer();
      dt.setData('application/x-scamp-component', name);
      dt.effectAllowed = 'copy';
      const start = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      });
      sourceEl.dispatchEvent(start);
      const over = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
        clientX: x,
        clientY: y,
      });
      frame.dispatchEvent(over);
      const drop = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
        clientX: x,
        clientY: y,
      });
      frame.dispatchEvent(drop);
      const end = new DragEvent('dragend', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      });
      sourceEl.dispatchEvent(end);
    },
    { name: componentName, x: clientX, y: clientY }
  );
};

/** Wait for a ConfirmDialog to appear by its title text. */
export const waitForConfirmDialog = async (
  page: Page,
  titleText: string | RegExp
): Promise<void> => {
  await page
    .getByRole('dialog')
    .filter({ has: page.getByText(titleText) })
    .waitFor({ state: 'visible' });
};

/** Click the primary confirm button inside the currently-open ConfirmDialog. */
export const confirmDialog = async (
  page: Page,
  label: string | RegExp
): Promise<void> => {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: label }).click();
};
