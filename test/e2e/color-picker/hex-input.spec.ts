import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('color picker: hex input', () => {
  test('typing a 6-digit hex into the Background color input writes it to CSS', async ({
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

    const colorText = panelSection(window, 'Background')
      .locator('input[type="text"]')
      .first();
    await colorText.click();
    await colorText.fill('#11aabb');
    await colorText.press('Enter');

    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*background:\\s*#11aabb`, 'si')
    );
  });
});
