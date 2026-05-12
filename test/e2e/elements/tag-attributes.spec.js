import { test, expect } from '../fixtures/app';
import { commitInput, drawAndSelectRect, panelSection, } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
test.describe('elements: tag-specific attributes', () => {
    test('anchor: href + target round-trip to TSX', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        // The Element section's LinkField now owns href / target / rel
        // for `<a>` (TAG_ATTRIBUTES['a'] is intentionally empty). Drive
        // the destination dropdown's External URL path to set the href —
        // this also tag-swaps the rect to `<a>` in one go.
        const section = panelSection(window, 'Element');
        // Selects in order: 1) Tag, 2) Destination ("Link to").
        await section.locator('select').nth(1).selectOption('external');
        const urlInput = section.getByPlaceholder('https://example.com');
        await commitInput(urlInput, 'https://example.com/about');
        await waitForSaved(window);
        // Toggle "Open in new tab" — only visible once the element is
        // an anchor. Adds target="_blank" + rel="noopener noreferrer".
        await section.locator('input[type="checkbox"]').check();
        await waitForSaved(window);
        const { tsx } = await readPageFiles(project.dir, project.pageName);
        expect(tsx).toMatch(new RegExp(`<a[^>]*data-scamp-id="${className}"`, 's'));
        expect(tsx).toMatch(/href="https:\/\/example\.com\/about"/);
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
        // Selects in order: 1) Tag, 2) Destination ("Link to" — added
        // by LinkField), 3) Method dropdown (the first tag-specific
        // attribute for `<form>`).
        await section.locator('select').nth(2).selectOption('post');
        await waitForSaved(window);
        const { tsx } = await readPageFiles(project.dir, project.pageName);
        expect(tsx).toMatch(/method="post"/);
    });
});
