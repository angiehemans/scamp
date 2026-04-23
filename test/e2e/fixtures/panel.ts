import type { Locator, Page } from '@playwright/test';

import { dragInFrame, selectTool } from './canvas';
import { canvasElementsByPrefix } from './selectors';

/**
 * Properties panel + canvas helpers used across Phase 3 specs. Keeping
 * these centralized means a layout refactor of the panel only requires
 * changing one file.
 */

/** The right-hand properties panel. */
export const propertiesPanel = (page: Page): Locator =>
  page.locator('[data-testid="properties-panel"]');

/** A named `<Section>` inside the properties panel. */
export const panelSection = (page: Page, title: string): Locator =>
  propertiesPanel(page).locator(`[data-panel-section="${title}"]`);

/**
 * Locate the input row inside a section by its inline prefix label
 * (e.g. "W" for Width, "Sz" for font size, "P" for Padding). Returns
 * the underlying `<input>` so specs can `.fill()`, `.press('Enter')`,
 * read `.inputValue()` etc. `data-prefix` comes from
 * `PrefixSuffixInput`.
 */
export const panelInputByPrefix = (
  page: Page,
  sectionTitle: string,
  prefix: string
): Locator =>
  panelSection(page, sectionTitle)
    .locator(`[data-prefix="${prefix}"] input`)
    .first();

/**
 * Draw a rectangle on the canvas and return the generated CSS class
 * name of the new rect (e.g. `rect_56a6`). After this call the new
 * rect is auto-selected — its properties-panel sections are live.
 * Caller is responsible for `waitForSaved` before reading disk.
 *
 * Uses `.last()` because canvas DOM is in DFS order, so the most
 * recently drawn rect is always the last match. A plain `.first()`
 * would return the earliest one in subsequent calls.
 */
export const drawAndSelectRect = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
): Promise<string> => {
  await selectTool(page, 'r');
  await dragInFrame(page, from, to);
  const rect = canvasElementsByPrefix(page, 'rect_').last();
  await rect.waitFor({ state: 'visible' });
  const className = await rect.getAttribute('data-scamp-id');
  if (!className) throw new Error('new rect has no data-scamp-id');
  return className;
};

/**
 * Commit an input field by typing a value and pressing Enter. The
 * PrefixSuffixInput used throughout the panel only fires its
 * `onCommit` on Enter or blur.
 */
export const commitInput = async (
  input: Locator,
  value: string
): Promise<void> => {
  await input.click({ clickCount: 3 });
  await input.fill(value);
  await input.press('Enter');
};

/**
 * Flip the properties panel between Visual and CSS mode.
 */
export const setPanelMode = async (
  page: Page,
  mode: 'Visual' | 'CSS'
): Promise<void> => {
  await propertiesPanel(page)
    .getByRole('radio', { name: mode })
    .click();
};
