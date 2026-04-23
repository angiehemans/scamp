import { test, expect } from '../fixtures/app';
import { drawAndSelectRect } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

/**
 * zundo's history is stored in a temporal store on `useCanvasStore`.
 * ProjectShell calls `temporal.clear()` inside the page-load effect
 * so switching pages resets undo.
 *
 * We can't inspect the temporal store from outside, but we can prove
 * history is gone observationally: if the history STILL contained
 * home's rect state after a switch, pressing Cmd+Z on the fresh
 * page would restore that rect (zundo pops the last past state and
 * writes it as the new present, and ElementRenderer renders from
 * whatever's in the store). A cleared history means Cmd+Z is a
 * no-op and the new page stays empty.
 */
test.describe('undo / redo: cleared by page switch', () => {
  test('Cmd+Z after a page switch does not restore the previous page\'s rect', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 220, y: 200 });
    await waitForSaved(window);
    await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(1);

    // Add a second page and switch to it.
    await window.getByRole('button', { name: /\+ Add Page/ }).click();
    const nameInput = window.getByPlaceholder('page-name');
    await nameInput.fill('about');
    await nameInput.press('Enter');
    // About loads with only a root element — no rects.
    await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(0);

    // Cmd+Z on about — if history carried over, the prior canvas
    // state (home-with-rect) would come back via zundo. Cleared
    // history means this is a no-op.
    await window.keyboard.press('ControlOrMeta+z');
    await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(0);
  });
});
