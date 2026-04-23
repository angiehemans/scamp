import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * The seeded project's theme.css ships a starter palette
 * (`--color-primary`, `--color-background`, etc.). The Tokens tab of
 * the color picker lists these and applies them as `var(--name)`.
 */
test.describe('color picker: tokens tab', () => {
  test('clicking a token applies var(--name) to the stored CSS', async ({
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

    // Open the color picker. The swatch button has no accessible
    // name (Tooltip wraps it without adding aria-label) — find it as
    // the first button in the Background section.
    await panelSection(window, 'Background').locator('button').first().click();

    // Switch to the Tokens tab and click the first swatch.
    await window.getByRole('button', { name: 'Tokens', exact: true }).click();
    await window.getByRole('button', { name: /^--color-primary/ }).click();

    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(
        `\\.${className}[^}]*background:\\s*var\\(--color-primary\\)`,
        's'
      )
    );
  });
});
