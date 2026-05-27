import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { canvasElement, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
/**
 * Canvas-side surfaces for linked elements:
 *   - A chain icon hovers above the element when it has an href.
 *   - The icon's title carries the destination so the user can see it
 *     without opening the panel.
 *   - When the destination is a broken page reference, the icon
 *     renders in a "broken" style and the Link panel shows a warning.
 */
test.describe('linking: canvas chain icon', () => {
    test('linking an element shows a chain icon on the canvas', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        // No icon before any link is set.
        const linkedRect = canvasElement(window, className);
        await expect(linkedRect).toBeVisible();
        // Indicators sit outside the element (siblings under
        // CanvasInteractionLayer). Match by aria-label "Links to ..."
        await expect(window.getByRole('button', { name: /^Links to/ })).toHaveCount(0);
        // Set an external link via the panel.
        const elementSection = panelSection(window, 'Element');
        const destination = elementSection.locator('select').nth(1);
        await destination.selectOption('external');
        const urlInput = elementSection.getByPlaceholder('https://example.com');
        await urlInput.click({ clickCount: 3 });
        await urlInput.fill('https://example.com');
        await urlInput.press('Enter');
        await waitForSaved(window);
        // Indicator should now be visible — its aria-label echoes the URL.
        await expect(window.getByRole('button', { name: /Opens https:\/\/example\.com/ })).toBeVisible({ timeout: 10_000 });
    });
    test('a broken page link shows the broken warning in the panel', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        // Hand-write a broken href into the file: `/missing-page` doesn't
        // exist in the project.
        const fs = await import('fs/promises');
        const path = await import('path');
        const tsxPath = path.join(project.dir, 'home.tsx');
        const tsx = await fs.readFile(tsxPath, 'utf-8');
        const patched = tsx.replace(new RegExp(`(<div data-scamp-id="${className}"[^>]*)/>`), '<a data-scamp-id="' +
            className +
            '" className={styles.' +
            className +
            '} href="/missing-page" />');
        expect(patched).not.toBe(tsx);
        await fs.writeFile(tsxPath, patched, 'utf-8');
        // The broken warning is a `<p>` containing
        // "Page /missing-page doesn't exist in this project."
        const warning = panelSection(window, 'Element').getByText(/Page\s+\/missing-page\s+doesn't exist/i);
        await expect(warning).toBeVisible({ timeout: 10_000 });
        // The canvas chain icon should render in the broken state — its
        // aria-label calls out "page not found".
        await expect(window.getByRole('button', {
            name: /Links to \/missing-page \(page not found/,
        })).toBeVisible();
    });
});
