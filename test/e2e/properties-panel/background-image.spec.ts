import { test, expect, stubOpenDialog, writeFixtureImage } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * "Set background image" in the Background section opens a native
 * file picker (stubbed here), copies the image into the project's
 * assets dir, and writes `background-image: url(...)` plus
 * `background-size`/`-position`/`-repeat` defaults to the rect's
 * class block. "Remove background image" clears all four.
 */
test.describe('properties panel: background image', () => {
  test('uploading a background image writes url() + size/position/repeat', async ({
    window,
    app,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    const fixturePath = await writeFixtureImage(project.dir, 'bg.png');
    await stubOpenDialog(app, fixturePath);

    const background = panelSection(window, 'Background');
    await background
      .getByRole('button', { name: 'Set background image' })
      .click();
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    const block = css.match(
      new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's')
    )?.[0];
    expect(block).toBeDefined();
    expect(block).toMatch(/background-image:\s*url\([^)]+\)/);
    expect(block).toContain('background-size: cover;');
    expect(block).toContain('background-position: center;');
    expect(block).toContain('background-repeat: no-repeat;');
  });

  test('"Remove background image" clears all four background props', async ({
    window,
    app,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    const fixturePath = await writeFixtureImage(project.dir, 'bg.png');
    await stubOpenDialog(app, fixturePath);

    const background = panelSection(window, 'Background');
    await background
      .getByRole('button', { name: 'Set background image' })
      .click();
    await waitForSaved(window);

    await background
      .getByRole('button', { name: 'Remove background image' })
      .click();
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    const block = css.match(
      new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's')
    )?.[0];
    expect(block).toBeDefined();
    expect(block).not.toMatch(/background-image:/);
    expect(block).not.toMatch(/background-size:/);
    expect(block).not.toMatch(/background-position:/);
    expect(block).not.toMatch(/background-repeat:/);
  });
});
