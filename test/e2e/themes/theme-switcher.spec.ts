import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';

test.use({ projectOptions: { format: 'nextjs' } });

test.describe('themes: theme switcher', () => {
  test('adding a theme writes a .dark block and a stacked Dark block appears', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();

    // "+ Add theme" duplicates Light into a new Dark block below.
    await panel.getByTestId('add-theme').click();

    await expect
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .toContain('.dark');
    await expect(
      panel.locator('[data-theme-block="dark"]')
    ).toBeVisible();
  });

  test('editing a semantic in the Dark block writes to .dark, not :root', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();

    await panel.getByTestId('add-theme').click();
    const darkBlock = panel.locator('[data-theme-block="dark"]');
    await expect(darkBlock).toBeVisible();

    // Re-map --color-background for the Dark theme only.
    await darkBlock
      .locator('select[aria-label="Mapping for --color-background"]')
      .selectOption('neutral:900');

    await expect
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .toMatch(/\.dark\s*\{[^}]*--color-background:\s*var\(--color-neutral-900\)/);

    // The :root (light) value is untouched — everything before the .dark block.
    const css = await project.readTheme();
    const rootBlock = css.slice(css.indexOf(':root'), css.indexOf('.dark'));
    expect(rootBlock).toContain('--color-background: var(--color-neutral-50)');
  });

  test('removing a theme drops its block from theme.css', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');

    await panel.getByTestId('add-theme').click();
    const darkBlock = panel.locator('[data-theme-block="dark"]');
    await expect(darkBlock).toBeVisible();
    await expect
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .toContain('.dark');

    await darkBlock
      .getByRole('button', { name: /Remove Dark theme/i })
      .click();

    await expect
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .not.toContain('.dark');
    await expect(darkBlock).toHaveCount(0);
  });

  test('the canvas toolbar switcher appears and toggles the previewed theme', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    // No switcher for a light-only project.
    await expect(window.getByTestId('canvas-theme-switcher')).toHaveCount(0);

    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await panel.getByTestId('add-theme').click();
    await expect(panel.locator('[data-theme-block="dark"]')).toBeVisible();

    // Close the theme panel to reveal the canvas toolbar.
    await window.locator('[data-section="design-system"]').click();
    const switcher = window.getByTestId('canvas-theme-switcher');
    await expect(switcher).toBeVisible();
    // Adding a theme leaves the preview on Light; the switcher can select Dark.
    await expect(switcher).toHaveValue('light');
    await switcher.selectOption('dark');
    await expect(switcher).toHaveValue('dark');
  });
});
