import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, propertiesPanel, setPanelMode } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
/**
 * CodeMirror + the CSS completion source register token suggestions
 * whenever the editor is focused inside a value position. We type
 * `color: var(--` and expect at least one seeded token
 * (e.g. `--color-primary`) to show up in the autocomplete list.
 */
test.describe('themes: CSS editor autocomplete', () => {
    test('typing `var(--` surfaces theme-token suggestions', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 220, y: 180 });
        await waitForSaved(window);
        await setPanelMode(window, 'CSS');
        const editor = propertiesPanel(window).locator('.cm-content').first();
        await editor.click();
        await window.keyboard.type('color: var(--');
        // CodeMirror renders completion popups in a `.cm-tooltip-autocomplete`
        // overlay. The option labels contain the token names.
        const tooltip = window.locator('.cm-tooltip-autocomplete').first();
        await expect(tooltip).toBeVisible({ timeout: 5_000 });
        await expect(tooltip.getByText(/--color-primary/)).toBeVisible();
    });
});
