import { test, expect } from '../fixtures/app';
import { canvasFrame, pageRoot } from '../fixtures/selectors';

/**
 * Zoom shortcuts set `userZoom` in the canvas store, which flows into
 * the `data-canvas-scale` attribute on the frame element. Reading it
 * from the DOM gives us a single stable observable.
 */
const readScale = async (page: import('@playwright/test').Page): Promise<number> => {
  const raw = await canvasFrame(page).getAttribute('data-canvas-scale');
  return Number(raw ?? '0');
};

test.describe('keyboard shortcuts: zoom', () => {
  test('Cmd+= zooms in; Cmd+- zooms out; Cmd+0 resets to fit', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const initialScale = await readScale(window);
    expect(initialScale).toBeGreaterThan(0);

    // Zoom in twice.
    await window.keyboard.press('ControlOrMeta+=');
    await window.keyboard.press('ControlOrMeta+=');
    await expect
      .poll(() => readScale(window), { timeout: 3000 })
      .toBeGreaterThan(initialScale);

    // Zoom out once.
    const zoomedIn = await readScale(window);
    await window.keyboard.press('ControlOrMeta+-');
    await expect
      .poll(() => readScale(window), { timeout: 3000 })
      .toBeLessThan(zoomedIn);

    // Reset — scale returns to the auto-fit value (same as initial).
    await window.keyboard.press('ControlOrMeta+0');
    await expect
      .poll(() => readScale(window), { timeout: 3000 })
      .toBeCloseTo(initialScale, 2);
  });
});
