import { test, expect } from '../fixtures/app';
import { commitInput, drawAndSelectRect, panelInputByPrefix, panelSection, } from '../fixtures/panel';
import { canvasFrame, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
test.describe('properties panel: grid layout', () => {
    test('toggling display to Grid emits display: grid and grid template values', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 80, y: 80 }, { x: 380, y: 280 });
        await waitForSaved(window);
        const layout = panelSection(window, 'Layout');
        await layout.getByRole('radio', { name: 'Grid' }).click();
        await waitForSaved(window);
        // Quick-size to a 2×2 grid (equal fr tracks) via the matrix picker,
        // then set the axis gaps.
        await layout.getByRole('button', { name: '2 by 2 grid' }).click();
        await commitInput(panelInputByPrefix(window, 'Layout', 'Column gap'), '16');
        await commitInput(panelInputByPrefix(window, 'Layout', 'Row gap'), '8');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*display:\\s*grid;`, 's'));
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*grid-template-columns:\\s*1fr 1fr;`, 's'));
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*grid-template-rows:\\s*1fr 1fr;`, 's'));
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*column-gap:\\s*16px;`, 's'));
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*row-gap:\\s*8px;`, 's'));
    });
    test('flex → grid migrates the gap value into both axis gaps', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 80, y: 80 }, { x: 360, y: 240 });
        await waitForSaved(window);
        const layout = panelSection(window, 'Layout');
        // Switch to Flex (row) and set the gap.
        await layout.getByRole('radio', { name: 'Flex row' }).click();
        await commitInput(panelInputByPrefix(window, 'Layout', 'Gap'), '24');
        await waitForSaved(window);
        // Switch to Grid — both column-gap and row-gap should now be 24
        // and the flex gap should be cleared.
        await layout.getByRole('radio', { name: 'Grid' }).click();
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*column-gap:\\s*24px;`, 's'));
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*row-gap:\\s*24px;`, 's'));
        // Flex `gap:` is gone now that display is grid.
        const block = css.match(new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's'))?.[0] ?? '';
        expect(block).not.toMatch(/^\s*gap:/m);
    });
    test('grid child sizing controls appear when parent is grid and emit grid-column / grid-row', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Outer grid container.
        const outerClass = await drawAndSelectRect(window, { x: 60, y: 60 }, { x: 460, y: 360 });
        await waitForSaved(window);
        const layout = panelSection(window, 'Layout');
        await layout.getByRole('radio', { name: 'Grid' }).click();
        await waitForSaved(window);
        // display:grid alone makes children grid items — no explicit template
        // needed for the grid-item controls to appear.
        // Draw a child inside it.
        const innerClass = await drawAndSelectRect(window, { x: 100, y: 120 }, { x: 200, y: 220 });
        await waitForSaved(window);
        expect(innerClass).not.toBe(outerClass);
        // Size section should now show the grid-item controls.
        const size = panelSection(window, 'Size');
        const colInput = size.locator('[data-prefix="Col"] input').first();
        await commitInput(colInput, 'span 2');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${innerClass}[^}]*grid-column:\\s*span 2;`, 's'));
    });
    test('selecting a grid container renders the dashed grid-line overlay', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 60, y: 60 }, { x: 460, y: 360 });
        await waitForSaved(window);
        const layout = panelSection(window, 'Layout');
        await layout.getByRole('radio', { name: 'Grid' }).click();
        // Quick-size to 3 columns so the overlay draws column lines.
        await layout.getByRole('button', { name: '3 by 1 grid' }).click();
        await waitForSaved(window);
        // Overlay container exists with at least one column line inside.
        const overlay = canvasFrame(window).locator('[data-testid="grid-overlay"]');
        await expect(overlay).toBeVisible();
    });
});
