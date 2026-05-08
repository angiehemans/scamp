import { test, expect } from '../fixtures/app';
import { commitInput, drawAndSelectRect, panelInputByPrefix, panelSection, } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
test.describe('properties panel: shadows', () => {
    test('"+ Add shadow" emits a default box-shadow shorthand', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const shadows = panelSection(window, 'Shadow');
        // The section is collapsible and starts collapsed when no shadows
        // are set — open it.
        await shadows.getByRole('button', { name: 'Shadow' }).click();
        await shadows.getByRole('button', { name: '+ Add shadow' }).click();
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        // Defaults: x=0, y=4, blur=8, spread=0, rgba(0,0,0,0.15), outset.
        // The generator omits a 0 spread so the emit has 3 lengths.
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*box-shadow:\\s*0px 4px 8px rgba\\(0, 0, 0, 0\\.15\\)`, 's'));
    });
    test('multiple shadows emit a comma-separated list', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const shadows = panelSection(window, 'Shadow');
        await shadows.getByRole('button', { name: 'Shadow' }).click();
        const addButton = shadows.getByRole('button', { name: '+ Add shadow' });
        await addButton.click();
        await addButton.click();
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        // Two default shadows → exactly one comma in the box-shadow value.
        const block = css.match(new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's'))?.[0];
        expect(block).toBeDefined();
        const shadowLine = block.match(/box-shadow:\s*([^;]+);/)?.[1];
        expect(shadowLine).toBeDefined();
        // Two segments → exactly one top-level comma. (rgba(...) commas are
        // inside parens and don't count for this test.)
        const segments = shadowLine.split(/,(?![^()]*\))/);
        expect(segments).toHaveLength(2);
    });
    test('inset toggle prepends `inset` to the shadow', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const shadows = panelSection(window, 'Shadow');
        await shadows.getByRole('button', { name: 'Shadow' }).click();
        await shadows.getByRole('button', { name: '+ Add shadow' }).click();
        await waitForSaved(window);
        // Toggle Inset on the first row's segmented control.
        await shadows.getByRole('radio', { name: 'Inset' }).first().click();
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*box-shadow:\\s*inset\\s+`, 's'));
    });
    test('opacity field rewrites the alpha component', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const shadows = panelSection(window, 'Shadow');
        await shadows.getByRole('button', { name: 'Shadow' }).click();
        await shadows.getByRole('button', { name: '+ Add shadow' }).click();
        await waitForSaved(window);
        // Default opacity is 15 (0.15). Bump to 50 → rgba alpha 0.5.
        const opacityInput = panelInputByPrefix(window, 'Shadow', 'O');
        await commitInput(opacityInput, '50');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*box-shadow:[^;]*rgba\\(0, 0, 0, 0\\.5\\)`, 's'));
    });
    test('remove button drops a shadow row from the CSS', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const shadows = panelSection(window, 'Shadow');
        await shadows.getByRole('button', { name: 'Shadow' }).click();
        const addButton = shadows.getByRole('button', { name: '+ Add shadow' });
        await addButton.click();
        await addButton.click();
        await waitForSaved(window);
        // Remove the first shadow row.
        await shadows
            .getByRole('button', { name: 'Remove shadow 1' })
            .click();
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        const block = css.match(new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's'))?.[0];
        expect(block).toBeDefined();
        // After removal, only one shadow → no top-level comma in the
        // box-shadow value.
        const shadowLine = block.match(/box-shadow:\s*([^;]+);/)?.[1];
        expect(shadowLine).toBeDefined();
        const segments = shadowLine.split(/,(?![^()]*\))/);
        expect(segments).toHaveLength(1);
    });
});
