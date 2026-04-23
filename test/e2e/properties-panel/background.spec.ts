import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('properties panel: background', () => {
  test('typing a hex value in the color text input writes CSS', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    // The Background section's first <input> is the color text field
    // (the color swatch is a <button>). Type a hex + blur.
    const colorText = panelSection(window, 'Background')
      .locator('input[type="text"]')
      .first();
    await colorText.click();
    await colorText.fill('#ff6600');
    await colorText.press('Enter');

    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*background:\\s*#ff6600`, 'si')
    );
  });
});
