import { test, expect } from '../fixtures/app';
import { commitInput, drawAndSelectRect, panelInputByPrefix, panelSection, } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
/**
 * The Size section's W / H inputs accept any CSS length string. Mode
 * is auto-detected from the value: `100%` → Stretch, `auto` → Auto,
 * `fit-content` → Hug, anything else (`100px`, `100vh`, `calc(...)`,
 * `var(--w)`, bare numbers) → Fixed.
 */
test.describe('properties panel: free-form size input', () => {
    test('typing 100vh stays Fixed and writes the verbatim value', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const heightInput = panelInputByPrefix(window, 'Size', 'H');
        await commitInput(heightInput, '100vh');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*height:\\s*100vh;`, 's'));
        // The height type indicator reflects the unit parsed from the value.
        await expect(panelSection(window, 'Size').getByRole('button', { name: 'Height type' })).toHaveAttribute('data-size-type', 'vh');
    });
    test('a bare number is treated as px', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const widthInput = panelInputByPrefix(window, 'Size', 'W');
        await commitInput(widthInput, '320');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*320px;`, 's'));
    });
    test('typing 100% switches the width type to Fill', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const widthInput = panelInputByPrefix(window, 'Size', 'W');
        await commitInput(widthInput, '100%');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*100%`, 's'));
        // 100% maps to the Fill type on the width field's type indicator.
        await expect(panelSection(window, 'Size').getByRole('button', { name: 'Width type' })).toHaveAttribute('data-size-type', 'fill');
    });
    test('typing auto / fit-content switches modes accordingly', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const widthInput = panelInputByPrefix(window, 'Size', 'W');
        await commitInput(widthInput, 'fit-content');
        await waitForSaved(window);
        let { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*fit-content`, 's'));
        await commitInput(widthInput, 'auto');
        await waitForSaved(window);
        ({ css } = await readPageFiles(project.dir, project.pageName));
        // 'auto' is a no-emit case for non-root elements — generator
        // omits the declaration entirely.
        const block = css.match(new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's'))?.[0];
        expect(block).toBeDefined();
        expect(block).not.toMatch(/width:/);
    });
    test('calc() and var() round-trip verbatim', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const widthInput = panelInputByPrefix(window, 'Size', 'W');
        await commitInput(widthInput, 'calc(100% - 20px)');
        await waitForSaved(window);
        let { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*calc\\(100% - 20px\\);`, 's'));
        await commitInput(widthInput, 'var(--page-w)');
        await waitForSaved(window);
        ({ css } = await readPageFiles(project.dir, project.pageName));
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*var\\(--page-w\\);`, 's'));
    });
});
