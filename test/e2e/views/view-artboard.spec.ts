import { test, expect } from '../fixtures/app';
import { createPageFromSidebar } from '../fixtures/components';
import { drawAndSelectRect } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

test.use({ projectOptions: { format: 'nextjs' } });

/**
 * A view is a page's design: its artboard is the page canvas width and
 * starts 900 tall, and the size control says the same thing the frame
 * does. The viewport, the size control, and the canvas floor used to
 * read three different defaults, so a view opened as a 480 × 320
 * component frame while the control claimed 1440 × 900.
 */
test('a new view opens on the page canvas that the size control agrees with', async ({
  window,
}) => {
  await expect(pageRoot(window)).toBeVisible();
  await createPageFromSidebar(window, 'landing');
  await expect(window.getByTitle('Select page root')).toHaveText('landing');
  // A view gets the page canvas: the breakpoint and its width, not a component artboard.
  await expect(window.getByRole('button', { name: /Desktop · 1440/ })).toBeVisible();

  const frame = window.locator('[class*="_frame_"]').first();
  const box = await frame.boundingBox();
  const root = await pageRoot(window).boundingBox();
  expect(Math.round(box?.width ?? 0)).toBe(1440);
  expect(Math.round(box?.height ?? 0)).toBe(900);
  expect(Math.round(root?.height ?? 0)).toBe(900);

  // Content shorter than the artboard doesn't change its height.
  await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 400, y: 300 });
  await waitForSaved(window);
  expect(Math.round((await frame.boundingBox())?.height ?? 0)).toBe(900);
});
