import { test, expect } from '../fixtures/app';
import {
  commitInput,
  drawAndSelectRect,
  panelInputByPrefix,
  panelSection,
} from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * The Size W/H fields carry an in-field type picker (px / % / Fill /
 * Hug / Auto). The field itself keeps accepting numbers, and ↑/↓ step
 * the value (Shift = ±10).
 */
test.describe('properties panel: size type picker', () => {
  const drawRect = async (
    window: Parameters<typeof pageRoot>[0]
  ): Promise<string> => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);
    return className;
  };

  const pickWidthType = async (
    window: Parameters<typeof pageRoot>[0],
    option: string
  ): Promise<void> => {
    await panelSection(window, 'Size')
      .getByRole('button', { name: 'Width type' })
      .click();
    await window.getByRole('option', { name: option }).click();
  };

  test('picking Fill emits width: 100%', async ({ window, project }) => {
    const className = await drawRect(window);
    await pickWidthType(window, 'Fill');
    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*100%`, 's'));
  });

  test('typing a number then picking Percent emits width in %', async ({
    window,
    project,
  }) => {
    const className = await drawRect(window);
    await commitInput(panelInputByPrefix(window, 'Size', 'W'), '50');
    await waitForSaved(window);
    await pickWidthType(window, 'Percent');
    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*50%`, 's'));
  });

  test('picking Hug (on a flex container) emits width: fit-content', async ({
    window,
    project,
  }) => {
    const className = await drawRect(window);
    // Hug/Auto only apply to content-sizing elements — make it a flex row.
    await panelSection(window, 'Layout')
      .getByRole('radio', { name: 'Flex row' })
      .click();
    await waitForSaved(window);
    await pickWidthType(window, 'Hug');
    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*width:\\s*fit-content`, 's')
    );
  });

  test('the type indicator reflects the current value', async ({ window }) => {
    await drawRect(window);
    const widthType = panelSection(window, 'Size').getByRole('button', {
      name: 'Width type',
    });
    await commitInput(panelInputByPrefix(window, 'Size', 'W'), '120');
    await expect(widthType).toHaveAttribute('data-size-type', 'px');
    await pickWidthType(window, 'Fill');
    await expect(widthType).toHaveAttribute('data-size-type', 'fill');
  });

  test('arrow keys step the value (±1, Shift ±10)', async ({
    window,
    project,
  }) => {
    const className = await drawRect(window);
    const widthInput = panelInputByPrefix(window, 'Size', 'W');
    await commitInput(widthInput, '100');
    await waitForSaved(window);

    await widthInput.press('ArrowUp');
    await waitForSaved(window);
    let css = (await readPageFiles(project.dir, project.pageName)).css;
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*101px`, 's'));

    await widthInput.press('Shift+ArrowUp');
    await waitForSaved(window);
    css = (await readPageFiles(project.dir, project.pageName)).css;
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*111px`, 's'));

    await widthInput.press('ArrowDown');
    await waitForSaved(window);
    css = (await readPageFiles(project.dir, project.pageName)).css;
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*110px`, 's'));
  });
});
