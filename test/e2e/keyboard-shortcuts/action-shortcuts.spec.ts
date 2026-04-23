import { test, expect } from '../fixtures/app';
import { drawAndSelectRect } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

test.describe('keyboard shortcuts: action shortcuts', () => {
  test('Cmd+D duplicates the selected element', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 220, y: 200 });
    await waitForSaved(window);
    await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(1);

    await window.keyboard.press('ControlOrMeta+d');
    await waitForSaved(window);
    await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(2);
  });

  test('Delete removes the selected element', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 220, y: 200 });
    await waitForSaved(window);
    await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(1);

    await window.keyboard.press('Delete');
    await waitForSaved(window);
    await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(0);
  });

  test('Cmd+C + Cmd+V copy and paste a rect', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 220, y: 200 });
    await waitForSaved(window);

    await window.keyboard.press('ControlOrMeta+c');
    await window.keyboard.press('ControlOrMeta+v');
    await waitForSaved(window);
    await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(2);
  });
});
