import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { layersRowByClass, layersRows } from '../fixtures/layers';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * The layers panel uses HTML5 drag-and-drop for reordering. Playwright's
 * default `dragTo` dispatches pointer events but not dragstart / drop,
 * so we dispatch the DnD event sequence directly via evaluate. This
 * mirrors what the browser would do for a real user drag.
 */
const reorderInTree = async (
  page: import('@playwright/test').Page,
  sourceSelector: string,
  targetSelector: string,
  position: 'before' | 'after' | 'inside'
): Promise<Record<string, unknown>> => {
  return await page.evaluate(
    ({ sourceSel, targetSel, pos }) => {
      const src = document.querySelector(sourceSel) as HTMLElement | null;
      const dst = document.querySelector(targetSel) as HTMLElement | null;
      if (!src || !dst) throw new Error('source or target not found');
      const DRAG_MIME = 'application/x-scamp-element-id';
      const elementId = (src as HTMLElement).dataset.elementId ?? '';

      const dataTransfer = new DataTransfer();
      dataTransfer.setData(DRAG_MIME, elementId);

      const diag: Record<string, unknown> = { elementId };

      const dragStartEvt = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      src.dispatchEvent(dragStartEvt);
      diag.afterDragStart_types = Array.from(dataTransfer.types);
      diag.afterDragStart_data = dataTransfer.getData(DRAG_MIME);

      const rect = dst.getBoundingClientRect();
      const y =
        pos === 'before'
          ? rect.top + rect.height * 0.1
          : pos === 'after'
            ? rect.top + rect.height * 0.9
            : rect.top + rect.height * 0.5;

      const dragOverEvt = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + rect.width / 2,
        clientY: y,
      });
      const dragOverDispatched = dst.dispatchEvent(dragOverEvt);
      diag.dragOverReturned = dragOverDispatched;
      diag.dragOverDefaultPrevented = dragOverEvt.defaultPrevented;
      diag.afterDragOver_types = Array.from(dataTransfer.types);
      diag.afterDragOver_data = dataTransfer.getData(DRAG_MIME);

      const dropEvt = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + rect.width / 2,
        clientY: y,
      });
      const dropDispatched = dst.dispatchEvent(dropEvt);
      diag.dropReturned = dropDispatched;
      diag.dropDefaultPrevented = dropEvt.defaultPrevented;
      diag.afterDrop_types = Array.from(dataTransfer.types);
      diag.afterDrop_data = dataTransfer.getData(DRAG_MIME);

      src.dispatchEvent(
        new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer })
      );
      return diag;
    },
    { sourceSel: sourceSelector, targetSel: targetSelector, pos: position }
  );
};

test.describe('layers panel: drag-and-drop reorder', () => {
  test('dropping one row after another reorders them in the tree', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    // Create two rects — they land as siblings under Page.
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 80, y: 80 }, { x: 180, y: 160 });
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 220, y: 80 }, { x: 320, y: 160 });
    await waitForSaved(window);

    const classes = await canvasElementsByPrefix(window, 'rect_').evaluateAll(
      (els) => els.map((el) => (el as HTMLElement).dataset.scampId ?? '')
    );
    expect(classes).toHaveLength(2);
    const [firstClass, secondClass] = classes;

    const initialOrder = await layersRows(window).evaluateAll((rows) =>
      rows.map((r) => (r as HTMLElement).dataset.elementClass ?? '')
    );
    expect(initialOrder).toEqual(['root', firstClass, secondClass]);

    // Drag the second row above the first.
    const diag = await reorderInTree(
      window,
      `[data-testid="layers-panel"] [data-element-class="${secondClass}"]`,
      `[data-testid="layers-panel"] [data-element-class="${firstClass}"]`,
      'before'
    );
    await waitForSaved(window);

    const nextOrder = await layersRows(window).evaluateAll((rows) =>
      rows.map((r) => (r as HTMLElement).dataset.elementClass ?? '')
    );
    if (JSON.stringify(nextOrder) !== JSON.stringify(['root', secondClass, firstClass])) {

      console.log('REORDER_DIAG:', JSON.stringify(diag));

      console.log('REORDER_NEXT_ORDER:', JSON.stringify(nextOrder));

      const dropDiag = await window.evaluate(
        () => (window as unknown as { __scampDropDiag?: unknown }).__scampDropDiag
      );

      console.log('REORDER_DROP_DIAG:', JSON.stringify(dropDiag));
    }
    expect(nextOrder).toEqual(['root', secondClass, firstClass]);
  });

  test('dropping onto a rectangle row (middle) re-parents as its last child', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    await selectTool(window, 'r');
    await dragInFrame(window, { x: 80, y: 80 }, { x: 400, y: 400 });
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 500, y: 80 }, { x: 600, y: 160 });
    await waitForSaved(window);

    const classes = await canvasElementsByPrefix(window, 'rect_').evaluateAll(
      (els) => els.map((el) => (el as HTMLElement).dataset.scampId ?? '')
    );
    const [outerClass, innerClass] = classes;
    if (!outerClass || !innerClass) throw new Error('need two rects');

    await reorderInTree(
      window,
      `[data-testid="layers-panel"] [data-element-class="${innerClass}"]`,
      `[data-testid="layers-panel"] [data-element-class="${outerClass}"]`,
      'inside'
    );
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
