import { test, expect } from '../fixtures/app';
import { commitInput, drawAndSelectRect, panelInputByPrefix, panelSection, } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
test.describe('properties panel: size controls', () => {
    test('typing a new W value writes width to CSS', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 240, y: 200 });
        await waitForSaved(window);
        const widthInput = panelInputByPrefix(window, 'Size', 'W');
        await commitInput(widthInput, '320');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*320px`, 's'));
    });
    test('switching the width type to Fill emits width: 100%', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        // The width mode is now an in-field type picker (px / % / Fill / Hug /
        // Auto). Fill maps to stretch → width: 100%.
        await panelSection(window, 'Size')
            .getByRole('button', { name: 'Width type' })
            .click();
        await window.getByRole('option', { name: 'Fill' }).click();
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*100%`, 's'));
    });
});
