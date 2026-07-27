import { test, expect } from '../fixtures/app';
import {
  drawAndSelectRect,
  panelSection,
} from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * The flex 3×3 alignment picker sets both `align-items` and
 * `justify-content` from a single click; double-clicking distributes
 * with `space-between`.
 */
test.describe('properties panel: flex alignment grid', () => {
  const setFlexRow = async (
    window: Parameters<typeof pageRoot>[0]
  ): Promise<string> => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 300, y: 220 }
    );
    await waitForSaved(window);
    await panelSection(window, 'Layout')
      .getByRole('radio', { name: 'Flex row' })
      .click();
    await waitForSaved(window);
    return className;
  };

  test('clicking the bottom-right cell emits flex-end on both axes', async ({
    window,
    project,
  }) => {
    const className = await setFlexRow(window);

    await panelSection(window, 'Layout')
      .getByRole('button', { name: 'Align bottom right' })
      .click();
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    // Bottom-right on a row → justify-content flex-end (horizontal/main),
    // align-items flex-end (vertical/cross).
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*justify-content:\\s*flex-end`, 's')
    );
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*align-items:\\s*flex-end`, 's')
    );
  });

  test('clicking the middle-center cell emits center on both axes', async ({
    window,
    project,
  }) => {
    const className = await setFlexRow(window);

    await panelSection(window, 'Layout')
      .getByRole('button', { name: 'Align middle center' })
      .click();
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*justify-content:\\s*center`, 's')
    );
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*align-items:\\s*center`, 's')
    );
  });

  test('double-clicking the grid distributes with space-between', async ({
    window,
    project,
  }) => {
    const className = await setFlexRow(window);

    await panelSection(window, 'Layout')
      .getByRole('group', { name: 'Alignment' })
      .dblclick();
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*justify-content:\\s*space-between`, 's')
    );
  });
});
