import { test, expect } from '../fixtures/app';
import { drawAndSelectRect } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
test.describe('undo / redo: 50-step history limit', () => {
    test('undoing past 50 edits stops before the rect disappears', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 200, y: 180 });
        await waitForSaved(window);
        // Produce 55 additional history entries by nudging right 55 times.
        for (let i = 0; i < 55; i += 1) {
            await window.keyboard.press('ArrowRight');
        }
        await waitForSaved(window);
        // Attempt 60 undo steps — more than the history limit. Without a
        // limit the 56th undo would erase the draw itself and the rect
        // would be gone; with limit=50 we hit the floor and the rect
        // survives.
        for (let i = 0; i < 60; i += 1) {
            await window.keyboard.press('ControlOrMeta+z');
        }
        await waitForSaved(window);
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(1);
    });
});
