import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
test.describe('canvas: nudge', () => {
    test('arrow keys move the selection by 1 px', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Draw a rect at (100, 100). The new rect is auto-selected.
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 100, y: 100 }, { x: 220, y: 200 });
        const className = await canvasElementsByPrefix(window, 'rect_').first().getAttribute('data-scamp-id');
        if (!className)
            throw new Error('no rect created');
        await waitForSaved(window);
        // Three right-arrows → +3px horizontally.
        await window.keyboard.press('ArrowRight');
        await window.keyboard.press('ArrowRight');
        await window.keyboard.press('ArrowRight');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*left:\\s*103px`, 's'));
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*top:\\s*100px`, 's'));
    });
    test('Shift+arrow moves the selection by 10 px', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 100, y: 100 }, { x: 220, y: 200 });
        const className = await canvasElementsByPrefix(window, 'rect_').first().getAttribute('data-scamp-id');
        if (!className)
            throw new Error('no rect created');
        await waitForSaved(window);
        // Shift+Down → +10 y. Shift+Right → +10 x. Total delta (+10, +10).
        await window.keyboard.press('Shift+ArrowDown');
        await window.keyboard.press('Shift+ArrowRight');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*left:\\s*110px`, 's'));
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*top:\\s*110px`, 's'));
    });
});
