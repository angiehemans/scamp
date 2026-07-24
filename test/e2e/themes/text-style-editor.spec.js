import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';
test.use({ projectOptions: { format: 'nextjs' } });
test.describe('themes: text style preview + popover editor', () => {
    test('a text style shows a preview and edits via a popover', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await window.locator('[data-section="design-system"]').click();
        const panel = window.getByTestId('theme-panel');
        await expect(panel).toBeVisible();
        await panel.getByTestId('add-default-text-styles').click();
        await expect
            .poll(async () => project.readTheme(), { timeout: 5_000 })
            .toContain('--text-h1-size: 2.5rem');
        // The H1 style renders a preview row; the preview label reads "H1".
        const h1Row = panel.locator('[data-text-style="h1"]');
        await expect(h1Row).toBeVisible();
        await expect(h1Row).toContainText('H1');
        // Click the preview to open the popover editor, change the size.
        await h1Row.getByRole('button', { name: 'Edit H1 text style' }).click();
        const sizeInput = window.locator('[data-prefix="Sz"] input');
        await expect(sizeInput).toBeVisible();
        await sizeInput.fill('3rem');
        await sizeInput.press('Enter');
        await expect
            .poll(async () => project.readTheme(), { timeout: 5_000 })
            .toContain('--text-h1-size: 3rem');
    });
    test('the weight combobox accepts a custom (non-preset) weight', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await window.locator('[data-section="design-system"]').click();
        const panel = window.getByTestId('theme-panel');
        await expect(panel).toBeVisible();
        await panel.getByTestId('add-default-text-styles').click();
        await expect
            .poll(async () => project.readTheme(), { timeout: 5_000 })
            .toContain('--text-h1-size: 2.5rem');
        await panel
            .locator('[data-text-style="h1"]')
            .getByRole('button', { name: 'Edit H1 text style' })
            .click();
        // Type a variable-font weight that isn't one of the named presets.
        const weightInput = window.getByRole('textbox', { name: 'Font weight' });
        await expect(weightInput).toBeVisible();
        await weightInput.fill('350');
        await weightInput.press('Enter');
        await expect
            .poll(async () => project.readTheme(), { timeout: 5_000 })
            .toContain('--text-h1-weight: 350');
    });
});
