import { test, expect } from '../fixtures/app';
import {
  commitInput,
  drawAndSelectRect,
  panelInputByPrefix,
} from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('properties panel: spacing shorthand', () => {
  test('single value applies to all four sides', async ({ window, project }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    const paddingInput = panelInputByPrefix(window, 'Spacing', 'P');
    await commitInput(paddingInput, '10');

    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*padding:\\s*10px 10px 10px 10px`, 's')
    );
  });

  test('two values apply to vertical / horizontal', async ({
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

    const paddingInput = panelInputByPrefix(window, 'Spacing', 'P');
    await commitInput(paddingInput, '10 20');

    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*padding:\\s*10px 20px 10px 20px`, 's')
    );
  });

  test('four values apply to top / right / bottom / left', async ({
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

    const paddingInput = panelInputByPrefix(window, 'Spacing', 'P');
    await commitInput(paddingInput, '1 2 3 4');

    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*padding:\\s*1px 2px 3px 4px`, 's')
    );
  });
});
