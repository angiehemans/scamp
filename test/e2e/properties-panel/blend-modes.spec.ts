import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('properties panel: blend modes', () => {
  test('mix-blend-mode dropdown writes the keyword to CSS', async ({
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

    // The Visibility section owns the mix-blend-mode dropdown.
    // It's the only <select> in the section.
    const visibility = panelSection(window, 'Visibility');
    const blendSelect = visibility.locator('select').first();
    await blendSelect.selectOption('multiply');
    await waitForSaved(window);

    let { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*mix-blend-mode:\\s*multiply`, 's')
    );

    // Switching back to Normal should drop the declaration entirely
    // (Normal is the default, generator skips it).
    await blendSelect.selectOption('normal');
    await waitForSaved(window);
    ({ css } = await readPageFiles(project.dir, project.pageName));
    const block = css.match(
      new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's')
    )?.[0];
    expect(block).toBeDefined();
    expect(block).not.toMatch(/mix-blend-mode/);
  });

  test('mix-blend-mode supports grouped values like color-burn / hard-light', async ({
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

    const blendSelect = panelSection(window, 'Visibility')
      .locator('select')
      .first();
    await blendSelect.selectOption('color-burn');
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*mix-blend-mode:\\s*color-burn`, 's')
    );
  });

  test('background-blend-mode is hidden until both bg color and bg image are set', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    const background = panelSection(window, 'Background');
    // Default rect has `backgroundColor: 'transparent'` AND no
    // background image — the Blend row in Background should be absent.
    // (The row is rendered only inside the `{bgImage && …}` branch
    // gated additionally on a non-transparent color.)
    await expect(
      background.getByText('Blend', { exact: true })
    ).toHaveCount(0);
  });
});
