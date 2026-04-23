import { test, expect } from '../fixtures/app';
import {
  commitInput,
  drawAndSelectRect,
  panelInputByPrefix,
  panelSection,
} from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('properties panel: border', () => {
  test('style / width / radius all round-trip to CSS', async ({
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

    // Border style — the <select> inside the Border section.
    const styleSelect = panelSection(window, 'Border').locator('select').first();
    await styleSelect.selectOption('dashed');

    // Border width — the "W" prefix input inside the Border section.
    const widthInput = panelInputByPrefix(window, 'Border', 'W');
    await commitInput(widthInput, '2');

    // Border radius — shorthand with 4 distinct corners.
    const radiusInput = panelInputByPrefix(window, 'Border', 'R');
    await commitInput(radiusInput, '4 8 12 16');

    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*border-style:\\s*dashed`, 's'));
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*border-width:\\s*2px 2px 2px 2px`, 's')
    );
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*border-radius:\\s*4px 8px 12px 16px`, 's')
    );
  });
});
