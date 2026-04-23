import { test, expect } from '../fixtures/app';
import { drawAndSelectRect } from '../fixtures/panel';
import { layersRowByClass } from '../fixtures/layers';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

test.describe('element naming: clear name', () => {
  test('clearing the name reverts to the default rect_ prefix', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const originalClass = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    // Rename → "Hero Card".
    let row = layersRowByClass(window, originalClass);
    await row.dblclick();
    let input = row.locator('input').first();
    await input.fill('Hero Card');
    await input.press('Enter');
    await waitForSaved(window);

    const renamed = canvasElementsByPrefix(window, 'hero_card_').first();
    const namedClass = await renamed.getAttribute('data-scamp-id');
    if (!namedClass) throw new Error('rename did not take effect');

    // Clear the name — rename again, empty the field, Enter.
    row = layersRowByClass(window, namedClass);
    await row.dblclick();
    input = row.locator('input').first();
    await expect(input).toHaveValue('Hero Card');
    await input.fill('');
    await input.press('Enter');
    await waitForSaved(window);

    // Back to a rect_ prefix with the same short id.
    const idSuffix = originalClass.split('_').pop();
    const restored = canvasElementsByPrefix(window, 'rect_').first();
    await expect(restored).toBeVisible();
    const restoredClass = await restored.getAttribute('data-scamp-id');
    expect(restoredClass).toBe(`rect_${idSuffix}`);
  });
});
