import { test, expect } from '../fixtures/app';
import { clickInFrame, selectTool } from '../fixtures/canvas';
import { panelSection } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
test.describe('typography: text creation', () => {
    test('T + click selects the new text element so Typography is available', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await selectTool(window, 't');
        await clickInFrame(window, { x: 180, y: 180 });
        await window.keyboard.press('Escape');
        await expect(canvasElementsByPrefix(window, 'text_').first()).toBeVisible();
        await waitForSaved(window);
        // Text element exposes Typography; Layout is hidden for text.
        await expect(panelSection(window, 'Typography')).toBeVisible();
    });
});
