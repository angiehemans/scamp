import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';

test.use({ projectOptions: { format: 'nextjs' } });

test.describe('themes: palette regenerate', () => {
  test('Generate keeps the palette in place (no jump to the bottom)', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();

    const palettes = panel.locator('[data-palette]');
    const orderBefore = await palettes.evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-palette'))
    );
    // The scaffold ships brand first.
    expect(orderBefore[0]).toBe('brand');

    await panel
      .locator('[data-palette="brand"]')
      .getByRole('button', { name: 'Generate' })
      .click();

    // brand stays first; the whole order is unchanged.
    await expect(palettes.first()).toHaveAttribute('data-palette', 'brand');
    const orderAfter = await palettes.evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-palette'))
    );
    expect(orderAfter).toEqual(orderBefore);
  });
});
