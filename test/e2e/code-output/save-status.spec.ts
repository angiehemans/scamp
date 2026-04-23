import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { pageRoot, saveStatus } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

test.describe('code output: save status', () => {
  test('starts on Saved after project load', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await waitForSaved(window);
    await expect(saveStatus(window)).toHaveAttribute('data-status', 'saved');
  });

  test('transitions saved → unsaved/saving → saved on edit', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await waitForSaved(window);

    await selectTool(window, 'r');
    await dragInFrame(window, { x: 120, y: 120 }, { x: 260, y: 240 });

    // Either 'unsaved' or 'saving' is acceptable mid-flight — the
    // debounce / IPC timing decides which one we catch first. What we
    // do require is that the indicator leaves 'saved' before returning.
    await expect(saveStatus(window)).not.toHaveAttribute(
      'data-status',
      'saved',
      { timeout: 2000 }
    );

    await waitForSaved(window);
  });
});
