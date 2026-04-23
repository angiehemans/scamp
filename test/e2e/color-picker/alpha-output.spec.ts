import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * The ColorInput accepts both hex (`#rrggbb`) and `rgba(r,g,b,a)`
 * literals via its text input, then emits whichever form the author
 * supplied to the element's stored color. Fully-opaque values round-trip
 * as hex; partially-transparent values round-trip as rgba().
 */
test.describe('color picker: alpha output format', () => {
  test('fully opaque → hex in the stored CSS', async ({ window, project }) => {
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
    await colorText.fill('#22cc44');
    await colorText.press('Enter');

    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*background:\\s*#22cc44`, 'si')
    );
  });

  test('alpha < 1 → rgba() in the stored CSS', async ({ window, project }) => {
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
    await colorText.fill('rgba(34, 204, 68, 0.5)');
    await colorText.press('Enter');

    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(
        `\\.${className}[^}]*background:\\s*rgba\\(34,\\s*204,\\s*68,\\s*0?\\.5\\)`,
        's'
      )
    );
  });
});
