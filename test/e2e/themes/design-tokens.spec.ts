import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';

test.use({ projectOptions: { format: 'nextjs' } });

test.describe('themes: spacing / border / radius / shadow tokens', () => {
  test('adding default spacing + radius writes grouped tokens to theme.css', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();

    await panel.getByTestId('add-default-spacing').click();
    await expect
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .toContain('--space-4: 16px');

    await panel.getByTestId('add-default-radius').click();
    await expect
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .toContain('--radius-full: 9999px');

    const css = await project.readTheme();
    // Organised under their own section comments.
    expect(css).toContain('/* Spacing */');
    expect(css).toContain('/* Radius */');
    expect(css.indexOf('/* Spacing */')).toBeLessThan(css.indexOf('--space-4'));
  });

  test('adding a single shadow token then renaming its label round-trips', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();

    await panel.getByTestId('add-default-shadow').click();
    await expect
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .toContain('--shadow-md');

    // The shadow value keeps its multi-layer comma form.
    expect(await project.readTheme()).toMatch(
      /--shadow-md:\s*0 4px 6px rgba\(0, 0, 0, 0\.07\), 0 2px 4px rgba\(0, 0, 0, 0\.06\)/
    );
  });

  test('the theme section nav lists and scroll-jumps to the new sections', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const nav = window.getByTestId('theme-section-nav');
    await expect(nav.locator('[data-theme-nav="spacing"]')).toBeVisible();
    await expect(nav.locator('[data-theme-nav="border"]')).toBeVisible();
    await expect(nav.locator('[data-theme-nav="radius"]')).toBeVisible();
    await expect(nav.locator('[data-theme-nav="shadow"]')).toBeVisible();

    await nav.locator('[data-theme-nav="shadow"]').click();
    await expect(
      window.locator('[data-theme-section="shadow"]')
    ).toBeInViewport();
  });
});
