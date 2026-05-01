import { test, expect } from '../fixtures/app';
import { clickInFrame, dragInFrame, frameToClient, measureFrame, selectTool, } from '../fixtures/canvas';
import { canvasElement, canvasElementsByPrefix, pageRoot, resizeHandle, } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
/**
 * Helper: draw a rectangle and return its class name once it lands on disk.
 */
const drawRect = async (window, from, to) => {
    await selectTool(window, 'r');
    await dragInFrame(window, from, to);
    const rect = canvasElementsByPrefix(window, 'rect_').first();
    await expect(rect).toBeVisible();
    const className = await rect.getAttribute('data-scamp-id');
    if (!className)
        throw new Error('new rect has no data-scamp-id');
    return className;
};
test.describe('canvas: select / move / resize', () => {
    test('clicking a rect selects it; clicking empty canvas deselects', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawRect(window, { x: 100, y: 100 }, { x: 250, y: 220 });
        // After drawing, select tool is active and rect is selected — resize
        // handles are visible.
        await expect(resizeHandle(window, 'se')).toBeVisible();
        // Click empty canvas → clears selection → handles go away.
        await selectTool(window, 'v');
        await clickInFrame(window, { x: 900, y: 800 });
        await expect(resizeHandle(window, 'se')).toHaveCount(0);
        // Click the rect again → re-selected.
        await clickInFrame(window, { x: 150, y: 150 });
        await expect(canvasElement(window, className)).toBeVisible();
        await expect(resizeHandle(window, 'se')).toBeVisible();
    });
    test('drag-moves an element and writes the new position to disk', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawRect(window, { x: 80, y: 80 }, { x: 280, y: 200 });
        await waitForSaved(window);
        // Select tool, then drag the rect from its interior by +100/+60.
        await selectTool(window, 'v');
        await dragInFrame(window, { x: 180, y: 140 }, { x: 280, y: 200 });
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        // Original left was 80, top was 80; drag delta was +100/+60 so
        // new left/top are 180/140.
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*left:\\s*180px`, 's'));
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*top:\\s*140px`, 's'));
    });
    test('SE resize handle grows the rect and writes the new size', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawRect(window, { x: 100, y: 100 }, { x: 200, y: 180 });
        await waitForSaved(window);
        // SE handle sits at the rect's bottom-right corner in frame coords
        // (200, 180). Drag it +80/+40 → new size 180×120.
        const metrics = await measureFrame(window);
        const startClient = frameToClient(metrics, { x: 200, y: 180 });
        const endClient = frameToClient(metrics, { x: 280, y: 220 });
        await window.mouse.move(startClient.x, startClient.y);
        await window.mouse.down();
        await window.mouse.move(endClient.x, endClient.y, { steps: 10 });
        await window.mouse.up();
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*180px`, 's'));
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*height:\\s*120px`, 's'));
    });
});
