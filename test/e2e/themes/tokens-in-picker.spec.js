import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
test.describe('themes: tokens surface in the color picker', () => {
    test('every seeded token appears in the Tokens tab of the color picker', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 220, y: 180 });
        await waitForSaved(window);
        await panelSection(window, 'Background').locator('button').first().click();
        await window.getByRole('button', { name: 'Tokens', exact: true }).click();
        for (const name of [
            '--color-primary',
            '--color-secondary',
            '--color-background',
            '--color-surface',
            '--color-text',
            '--color-muted',
        ]) {
            await expect(window.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
        }
    });
});
