import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * The visual grid builder: a quick N×M matrix picker seeds equal fr
 * tracks, and the per-axis track accordions add/remove tracks.
 */
test.describe('properties panel: grid builder', () => {
  const drawGrid = async (
    window: Parameters<typeof pageRoot>[0]
  ): Promise<string> => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 80, y: 80 },
      { x: 380, y: 280 }
    );
    await waitForSaved(window);
    await panelSection(window, 'Layout')
      .getByRole('radio', { name: 'Grid' })
      .click();
    await waitForSaved(window);
    return className;
  };

  test('quick picker sets equal fr tracks for the chosen size', async ({
    window,
    project,
  }) => {
    const className = await drawGrid(window);

    await panelSection(window, 'Layout')
      .getByRole('button', { name: '3 by 2 grid' })
      .click();
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*grid-template-columns:\\s*1fr 1fr 1fr;`, 's')
    );
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*grid-template-rows:\\s*1fr 1fr;`, 's')
    );
  });

  test('the Columns accordion adds a track', async ({ window, project }) => {
    const className = await drawGrid(window);
    const layout = panelSection(window, 'Layout');

    // Start from a 2×2 grid, then add one column track.
    await layout.getByRole('button', { name: '2 by 2 grid' }).click();
    await waitForSaved(window);
    await layout.getByRole('button', { name: 'Columns' }).click(); // expand
    await layout.getByRole('button', { name: 'Add column' }).click();
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*grid-template-columns:\\s*1fr 1fr 1fr;`, 's')
    );
  });
});
