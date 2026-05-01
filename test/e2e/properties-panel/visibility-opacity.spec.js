import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
test.describe('properties panel: visibility / opacity', () => {
    test('typing opacity emits opacity: x.y', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const opacityInput = panelSection(window, 'Visibility')
            .locator('input')
            .first();
        await opacityInput.click({ clickCount: 3 });
        await opacityInput.fill('50');
        await opacityInput.press('Enter');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*opacity:\\s*0\\.5`, 's'));
    });
    test('Display: Hidden emits visibility: hidden', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        await panelSection(window, 'Visibility')
            .getByRole('radio', { name: 'Hidden' })
            .click();
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*visibility:\\s*hidden`, 's'));
    });
    test('Display: None emits display: none', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        await panelSection(window, 'Visibility')
            .getByRole('radio', { name: 'None' })
            .click();
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*display:\\s*none`, 's'));
    });
});
