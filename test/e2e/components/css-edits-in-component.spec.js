import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, propertiesPanel, setPanelMode } from '../fixtures/panel';
import { createComponentFromSidebar } from '../fixtures/components';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
test.use({ projectOptions: { format: 'nextjs' } });
test.describe('components: CSS panel inside the component editor', () => {
    test('Cmd+S saves CSS edits to the component module file', async ({ window, project, }) => {
        // Regression guard: CssPanel only set editTargetRef when
        // activePage was set, so in the component editor (where
        // activeComponent is set and activePage is null) the save
        // target was null and Cmd+S + click-outside both silently
        // no-op'd. Fix routes editTargetRef through whichever of
        // activePage / activeComponent is currently active.
        await expect(pageRoot(window)).toBeVisible();
        await createComponentFromSidebar(window, 'Card');
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 220, y: 180 });
        await waitForSaved(window);
        await setPanelMode(window, 'CSS');
        const editor = propertiesPanel(window).locator('.cm-content').first();
        await editor.click();
        await window.keyboard.type('letter-spacing: 4px;');
        await window.keyboard.press('Control+s');
        await waitForSaved(window);
        const { css } = await project.readComponent('Card');
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*letter-spacing:\\s*4px`, 's'));
    });
    test('blur (click outside the editor) also commits CSS edits', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await createComponentFromSidebar(window, 'Card');
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 220, y: 180 });
        await waitForSaved(window);
        await setPanelMode(window, 'CSS');
        const editor = propertiesPanel(window).locator('.cm-content').first();
        await editor.click();
        await window.keyboard.type('word-spacing: 2px;');
        // Blur path: click somewhere neutral outside the editor.
        await pageRoot(window).click();
        await waitForSaved(window);
        const { css } = await project.readComponent('Card');
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*word-spacing:\\s*2px`, 's'));
    });
});
