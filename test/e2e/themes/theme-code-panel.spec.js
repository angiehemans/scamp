import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';
test.use({ projectOptions: { format: 'nextjs' } });
test.describe('themes: Code panel follows the Design System view', () => {
    test('Code shows theme.css while the theme panel is open, page code otherwise', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // On a page, the Code panel shows the page's TSX + CSS.
        await window.getByRole('button', { name: /^Code$/ }).click();
        await expect(window.getByText('home.tsx', { exact: true })).toBeVisible();
        // Opening the Design System panel switches Code to the theme file.
        await window.locator('[data-section="design-system"]').click();
        await expect(window.getByText('app/theme.css', { exact: true })).toBeVisible();
        await expect(window.getByText('home.tsx', { exact: true })).toHaveCount(0);
        // The pane carries the actual theme.css content (a top-of-file token).
        await expect(window.locator('.cm-content').first()).toContainText('--color-brand-50');
        // Returning to a page section restores the page code view.
        await window.locator('[data-section="pages"]').click();
        await expect(window.getByText('home.tsx', { exact: true })).toBeVisible();
    });
});
