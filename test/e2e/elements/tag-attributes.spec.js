import { test, expect } from '../fixtures/app';
import { commitInput, drawAndSelectRect, panelSection, } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
test.describe('elements: tag-specific attributes', () => {
    test('anchor: href + target round-trip to TSX', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const section = panelSection(window, 'Element');
        await section.locator('select').first().selectOption('a');
        // Text input for href appears once the tag is anchor.
        const hrefInput = section.locator('input[placeholder="/path"]').first();
        await commitInput(hrefInput, '/about');
        await section.locator('select').nth(1).selectOption('_blank');
        await waitForSaved(window);
        const { tsx } = await readPageFiles(project.dir, project.pageName);
        expect(tsx).toMatch(new RegExp(`<a[^>]*data-scamp-id="${className}"`, 's'));
        expect(tsx).toMatch(/href="\/about"/);
        expect(tsx).toMatch(/target="_blank"/);
    });
    test('dialog: Open checkbox emits the boolean attribute', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const section = panelSection(window, 'Element');
        await section.locator('select').first().selectOption('dialog');
        await section.locator('input[type="checkbox"]').first().check();
        await waitForSaved(window);
        const { tsx } = await readPageFiles(project.dir, project.pageName);
        // Boolean attribute is emitted without `="..."`.
        expect(tsx).toMatch(new RegExp(`<dialog[^>]*data-scamp-id="${className}"[^>]*\\sopen(\\s|/?>)`, 's'));
    });
    test('form: method GET / POST picks up the value attribute', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const section = panelSection(window, 'Element');
        await section.locator('select').first().selectOption('form');
        // The first select after the tag select is the method dropdown.
        await section.locator('select').nth(1).selectOption('post');
        await waitForSaved(window);
        const { tsx } = await readPageFiles(project.dir, project.pageName);
        expect(tsx).toMatch(/method="post"/);
    });
});
