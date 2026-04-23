import { test, expect } from '../fixtures/app';
import { drawAndSelectRect } from '../fixtures/panel';
import { layersRowByClass } from '../fixtures/layers';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

test.describe('layers panel: hover tooltip shows the CSS class name', () => {
  test('hovering a row surfaces `.{className}` via the tooltip portal', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const cls = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 240, y: 200 }
    );
    await waitForSaved(window);

    // Tooltip has a 400 ms delay before showing — hover until it
    // renders. Portal mount means it sits in document.body with
    // role="tooltip".
    await layersRowByClass(window, cls).hover();
    await expect(
      window.getByRole('tooltip').filter({ hasText: `.${cls}` })
    ).toBeVisible({ timeout: 2_000 });
  });
});
