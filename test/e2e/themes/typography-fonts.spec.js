import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';
test.use({ projectOptions: { format: 'nextjs' } });
test.describe('themes: font manager in the Typography section', () => {
    test('the font-add component appears in the theme panel and writes @import', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await window.locator('[data-section="design-system"]').click();
        const panel = window.getByTestId('theme-panel');
        await expect(panel).toBeVisible();
        const pasteInput = panel.getByPlaceholder(/^Paste a Google Fonts or Adobe Fonts embed link/);
        await expect(pasteInput).toBeVisible();
        await pasteInput.fill('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap');
        await panel.getByRole('button', { name: 'Add', exact: true }).click();
        await expect
            .poll(async () => project.readTheme(), { timeout: 5_000 })
            .toContain('@import');
        expect(await project.readTheme()).toContain('fonts.googleapis.com');
    });
});
