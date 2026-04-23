import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { drawAndSelectRect } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

test.describe('undo / redo: basic', () => {
  test('Cmd+Z undoes an add; Cmd+Shift+Z redoes it', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 100, y: 100 }, { x: 240, y: 200 });
    const rect = canvasElementsByPrefix(window, 'rect_').first();
    await expect(rect).toBeVisible();
    const className = await rect.getAttribute('data-scamp-id');
    if (!className) throw new Error('no rect created');
    await waitForSaved(window);

    // Undo — the rect disappears.
    await window.keyboard.press('ControlOrMeta+z');
    await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(0);
    await waitForSaved(window);

    // Redo — same className comes back.
    await window.keyboard.press('ControlOrMeta+Shift+z');
    await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(1);
    const restored = await canvasElementsByPrefix(window, 'rect_')
      .first()
      .getAttribute('data-scamp-id');
    expect(restored).toBe(className);
  });

  test('multiple sequential edits each undo one step', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    const first = await drawAndSelectRect(
      window,
      { x: 80, y: 80 },
      { x: 180, y: 160 }
    );
    await waitForSaved(window);
    const second = await drawAndSelectRect(
      window,
      { x: 220, y: 80 },
      { x: 320, y: 160 }
    );
    await waitForSaved(window);
    expect(first).not.toBe(second);

    // Undo once → second rect gone.
    await window.keyboard.press('ControlOrMeta+z');
    await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(1);
    // Undo again → first rect gone.
    await window.keyboard.press('ControlOrMeta+z');
    await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(0);
    await waitForSaved(window);
  });
});
