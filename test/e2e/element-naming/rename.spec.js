import { test, expect } from '../fixtures/app';
import { drawAndSelectRect } from '../fixtures/panel';
import { layersRowByClass } from '../fixtures/layers';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
test.describe('element naming: rename via layers panel', () => {
    test('double-click rename writes a slugified class; title-case in panel', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const originalClass = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const row = layersRowByClass(window, originalClass);
        await row.dblclick();
        const input = row.locator('input').first();
        await expect(input).toBeVisible();
        await input.fill('Hero Card');
        await input.press('Enter');
        await waitForSaved(window);
        // The CSS class now uses the slugified name.
        const renamed = canvasElementsByPrefix(window, 'hero_card_').first();
        await expect(renamed).toBeVisible();
        const newClass = await renamed.getAttribute('data-scamp-id');
        expect(newClass).toMatch(/^hero_card_[a-z0-9]+$/);
        // Short-id suffix is preserved across the rename.
        const idSuffix = originalClass.split('_').pop();
        expect(newClass.endsWith(`_${idSuffix}`)).toBe(true);
        // Layer row label renders in title case — "Hero Card".
        await expect(layersRowByClass(window, newClass).getByRole('button', {
            name: 'Hero Card',
        })).toBeVisible();
        // The CSS file carries the renamed class block.
        const { tsx, css } = await readPageFiles(project.dir, project.pageName);
        expect(tsx).toContain(`data-scamp-id="${newClass}"`);
        expect(css).toContain(`.${newClass}`);
        expect(css).not.toContain(`.${originalClass}`);
    });
});
