import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { layersRows } from '../fixtures/layers';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
/**
 * The layers panel uses HTML5 drag-and-drop for reordering. Playwright's
 * default `dragTo` dispatches pointer events but not dragstart / drop,
 * so we dispatch the DnD event sequence directly via evaluate. This
 * mirrors what the browser would do for a real user drag.
 */
const reorderInTree = async (page, sourceSelector, targetSelector, position) => {
    await page.evaluate(({ sourceSel, targetSel, pos }) => {
        const src = document.querySelector(sourceSel);
        const dst = document.querySelector(targetSel);
        if (!src || !dst)
            throw new Error('source or target not found');
        const DRAG_MIME = 'application/x-scamp-element-id';
        const elementId = src.dataset.elementId ?? '';
        const dataTransfer = new DataTransfer();
        dataTransfer.setData(DRAG_MIME, elementId);
        src.dispatchEvent(new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
        }));
        const rect = dst.getBoundingClientRect();
        const y = pos === 'before'
            ? rect.top + rect.height * 0.1
            : pos === 'after'
                ? rect.top + rect.height * 0.9
                : rect.top + rect.height * 0.5;
        dst.dispatchEvent(new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: rect.left + rect.width / 2,
            clientY: y,
        }));
        dst.dispatchEvent(new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: rect.left + rect.width / 2,
            clientY: y,
        }));
        src.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer }));
    }, { sourceSel: sourceSelector, targetSel: targetSelector, pos: position });
};
test.describe('layers panel: drag-and-drop reorder', () => {
    test('dropping one row after another reorders them in the tree', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Create two rects — they land as siblings under Page.
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 80, y: 80 }, { x: 180, y: 160 });
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 220, y: 80 }, { x: 320, y: 160 });
        await waitForSaved(window);
        const classes = await canvasElementsByPrefix(window, 'rect_').evaluateAll((els) => els.map((el) => el.dataset.scampId ?? ''));
        expect(classes).toHaveLength(2);
        const [firstClass, secondClass] = classes;
        const initialOrder = await layersRows(window).evaluateAll((rows) => rows.map((r) => r.dataset.elementClass ?? ''));
        expect(initialOrder).toEqual(['root', firstClass, secondClass]);
        // Drag the second row above the first.
        await reorderInTree(window, `[data-testid="layers-panel"] [data-element-class="${secondClass}"]`, `[data-testid="layers-panel"] [data-element-class="${firstClass}"]`, 'before');
        await waitForSaved(window);
        const nextOrder = await layersRows(window).evaluateAll((rows) => rows.map((r) => r.dataset.elementClass ?? ''));
        expect(nextOrder).toEqual(['root', secondClass, firstClass]);
    });
    test('dropping onto a rectangle row (middle) re-parents as its last child', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 80, y: 80 }, { x: 400, y: 400 });
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 500, y: 80 }, { x: 600, y: 160 });
        await waitForSaved(window);
        const classes = await canvasElementsByPrefix(window, 'rect_').evaluateAll((els) => els.map((el) => el.dataset.scampId ?? ''));
        const [outerClass, innerClass] = classes;
        if (!outerClass || !innerClass)
            throw new Error('need two rects');
        await reorderInTree(window, `[data-testid="layers-panel"] [data-element-class="${innerClass}"]`, `[data-testid="layers-panel"] [data-element-class="${outerClass}"]`, 'inside');
        await waitForSaved(window);
        // The inner rect is now nested inside the outer in the TSX.
        const { tsx } = await readPageFiles(project.dir, project.pageName);
        const outerStart = tsx.indexOf(`data-scamp-id="${outerClass}"`);
        const innerStart = tsx.indexOf(`data-scamp-id="${innerClass}"`);
        const outerEnd = tsx.indexOf('</div>', outerStart);
        expect(outerStart).toBeGreaterThan(-1);
        expect(innerStart).toBeGreaterThan(outerStart);
        expect(innerStart).toBeLessThan(outerEnd);
    });
});
